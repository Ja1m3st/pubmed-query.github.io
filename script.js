const fields = [
    'All Fields',
    'Title',
    'Title/Abstract',
    'Abstract',
    'Author',
    'Journal',
    'MeSH Terms',
    'Affiliation',
    'PMID'
];

const operators = ['AND', 'OR', 'NOT'];

const articleTypeOptions = [
    'Clinical Trial',
    'Meta-Analysis',
    'Randomized Controlled Trial',
    'Review',
    'Systematic Review',
    'Case Reports',
    'Comparative Study',
    'Letter',
    'Editorial'
];

const languageOptions = ['English', 'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Chinese'];

const fieldMapping = {
    'All Fields': '',
    'Title': '[Title]',
    'Title/Abstract': '[Title/Abstract]',
    'Abstract': '[Abstract]',
    'Author': '[Author]',
    'Journal': '[Journal]',
    'MeSH Terms': '[MeSH Terms]',
    'Affiliation': '[Affiliation]',
    'PMID': '[PMID]'
};

let terms = [{ text: '', field: 'All Fields', operator: 'AND' }];

function init() {
    renderTerms();
    renderArticleTypes();
    renderLanguages();
    updateQuery();
}

function renderTerms() {
	const container = document.getElementById('termsContainer');
	container.innerHTML = '';

	terms.forEach((term, index) => {
			const termGroup = document.createElement('div');
			termGroup.className = 'term-group';

			if (index > 0) {
					const operatorSelect = document.createElement('select');
					operatorSelect.className = 'operator-select';
					operators.forEach(op => {
							const option = document.createElement('option');
							option.value = op;
							option.textContent = op;
							option.selected = term.operator === op;
							operatorSelect.appendChild(option);
					});
					operatorSelect.onchange = (e) => {
							terms[index].operator = e.target.value;
							updateQuery();
					};
					termGroup.appendChild(operatorSelect);
			}

			const termRow = document.createElement('div');
			termRow.className = 'term-row';

			const input = document.createElement('input');
			input.type = 'text';
			input.className = 'term-input';
			input.placeholder = 'Introduce término de búsqueda...';
			input.value = term.text;
			input.oninput = (e) => {
					terms[index].text = e.target.value;
					updateQuery();
			};

			const fieldSelect = document.createElement('select');
			fieldSelect.className = 'field-select';
			fields.forEach(field => {
					const option = document.createElement('option');
					option.value = field;
					option.textContent = field;
					option.selected = term.field === field;
					fieldSelect.appendChild(option);
			});
			fieldSelect.onchange = (e) => {
					terms[index].field = e.target.value;
					updateQuery();
			};

			termRow.appendChild(input);
			termRow.appendChild(fieldSelect);

			if (terms.length > 1) {
					const removeBtn = document.createElement('button');
					removeBtn.className = 'btn btn-danger';
					removeBtn.innerHTML = '✕';
					removeBtn.onclick = () => removeTerm(index);
					termRow.appendChild(removeBtn);
			}

			termGroup.appendChild(termRow);
			container.appendChild(termGroup);
	});
}

function addTerm() {
	terms.push({ text: '', field: 'All Fields', operator: 'AND' });
	renderTerms();
	updateQuery();
}

function removeTerm(index) {
	if (terms.length > 1) {
			terms.splice(index, 1);
			renderTerms();
			updateQuery();
	}
}

function renderArticleTypes() {
	const container = document.getElementById('articleTypes');
	articleTypeOptions.forEach(type => {
			const label = document.createElement('label');
			label.className = 'checkbox-label';

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.value = type;
			checkbox.onchange = updateQuery;

			const span = document.createElement('span');
			span.textContent = type;

			label.appendChild(checkbox);
			label.appendChild(span);
			container.appendChild(label);
	});
}

function renderLanguages() {
	const select = document.getElementById('language');
	languageOptions.forEach(lang => {
			const option = document.createElement('option');
			option.value = lang;
			option.textContent = lang;
			select.appendChild(option);
	});
}

function generateQuery() {
	let query = '';

	const validTerms = terms.filter(t => t.text.trim());
	validTerms.forEach((term, index) => {
			if (index > 0) {
					query += ` ${term.operator} `;
			}
			const fieldTag = fieldMapping[term.field];
			if (term.text.includes(' ') && !term.text.startsWith('"')) {
					query += `"${term.text}"${fieldTag}`;
			} else {
					query += `${term.text}${fieldTag}`;
			}
	});

	const dateFrom = document.getElementById('dateFrom').value;
	const dateTo = document.getElementById('dateTo').value;
	if (dateFrom || dateTo) {
			if (query) query += ' AND ';
			const from = dateFrom || '1900/01/01';
			const to = dateTo || '3000/12/31';
			query += `("${from}"[Date - Publication] : "${to}"[Date - Publication])`;
	}

	const selectedTypes = Array.from(document.querySelectorAll('#articleTypes input:checked'))
			.map(cb => cb.value);
	if (selectedTypes.length > 0) {
			if (query) query += ' AND ';
			query += '(' + selectedTypes.map(type => `"${type}"[Publication Type]`).join(' OR ') + ')';
	}

	const species = document.getElementById('species').value.trim();
	if (species) {
			if (query) query += ' AND ';
			query += `"${species}"[MeSH Terms]`;
	}

	const language = document.getElementById('language').value;
	if (language) {
			if (query) query += ' AND ';
			query += `${language.toLowerCase()}[Language]`;
	}

	// Filtros de acceso
	const freeFullText = document.getElementById('freeFullText').checked;
	if (freeFullText) {
			if (query) query += ' AND ';
			query += 'free full text[filter]';
	}

	const openAccess = document.getElementById('openAccess').checked;
	if (openAccess) {
			if (query) query += ' AND ';
			query += 'open access[filter]';
	}

	const abstract = document.getElementById('abstract').checked;
	if (abstract) {
			if (query) query += ' AND ';
			query += 'hasabstract[text]';
	}

	return query || '(No hay filtros aplicados)';
}

function updateQuery() {
	const query = generateQuery();
	document.getElementById('queryOutput').textContent = query;
}

function copyQuery() {
	const query = generateQuery();
	navigator.clipboard.writeText(query).then(() => {
			const btn = document.getElementById('copyText');
			btn.textContent = '¡Copiado!';
			setTimeout(() => {
					btn.textContent = 'Copiar';
			}, 2000);
	});
}

document.getElementById('dateFrom').addEventListener('change', updateQuery);
document.getElementById('dateTo').addEventListener('change', updateQuery);
document.getElementById('species').addEventListener('input', updateQuery);
document.getElementById('language').addEventListener('change', updateQuery);

init();