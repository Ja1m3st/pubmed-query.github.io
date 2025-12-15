        // Variables y configuraciones
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

        // Ejemplos predefinidos
        const examples = {
            breastCancer: {
                terms: [
                    { text: 'breast cancer', field: 'Title/Abstract', operator: 'AND' },
                    { text: 'chemotherapy', field: 'Title/Abstract', operator: 'AND' }
                ],
                species: '',
                language: 'English',
                articleTypes: [],
                freeFullText: false,
                openAccess: false,
                abstract: true
            },
            diabetesMeta: {
                terms: [
                    { text: 'diabetes', field: 'Title/Abstract', operator: 'AND' }
                ],
                species: 'Humans',
                language: 'English',
                articleTypes: ['Meta-Analysis', 'Systematic Review'],
                freeFullText: true,
                openAccess: false,
                abstract: true
            },
            alzheimer: {
                terms: [
                    { text: 'Alzheimer Disease', field: 'MeSH Terms', operator: 'AND' },
                    { text: 'Humans', field: 'MeSH Terms', operator: 'AND' }
                ],
                species: 'Humans',
                language: 'English',
                articleTypes: [],
                freeFullText: false,
                openAccess: false,
                abstract: false
            },
            covidVaccine: {
                terms: [
                    { text: 'COVID-19', field: 'Title/Abstract', operator: 'AND' },
                    { text: 'vaccine', field: 'Title/Abstract', operator: 'OR' },
                    { text: 'vaccination', field: 'Title/Abstract', operator: 'AND' }
                ],
                species: 'Humans',
                language: 'English',
                articleTypes: ['Clinical Trial'],
                freeFullText: true,
                openAccess: false,
                abstract: true
            },
            lungCancer: {
                terms: [
                    { text: 'lung cancer', field: 'Title/Abstract', operator: 'AND' },
                    { text: 'genetic', field: 'Title/Abstract', operator: 'OR' },
                    { text: 'mutation', field: 'Title/Abstract', operator: 'AND' },
                    { text: 'Mice', field: 'MeSH Terms', operator: 'AND' }
                ],
                species: 'Mice',
                language: 'English',
                articleTypes: [],
                freeFullText: false,
                openAccess: false,
                abstract: true
            },
            exerciseMental: {
                terms: [
                    { text: 'exercise', field: 'Title/Abstract', operator: 'AND' },
                    { text: 'depression', field: 'Title/Abstract', operator: 'OR' },
                    { text: 'anxiety', field: 'Title/Abstract', operator: 'AND' },
                    { text: 'Review', field: 'Publication Type', operator: 'AND' }
                ],
                species: 'Humans',
                language: 'English',
                articleTypes: ['Review'],
                freeFullText: false,
                openAccess: true,
                abstract: true
            }
        };

        // Funciones principales
        function init() {
            renderTerms();
            renderArticleTypes();
            renderLanguages();
            updateQuery();
            renderCommonExamples();
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
            container.innerHTML = '';
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
            select.innerHTML = '<option value="">Cualquier idioma</option>';
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

        // Funciones para la guía modal
        function openGuide() {
            document.getElementById('guideModal').style.display = 'block';
            document.body.style.overflow = 'hidden';
        }

        function closeGuide() {
            document.getElementById('guideModal').style.display = 'none';
            document.body.style.overflow = 'auto';
        }

        function switchTab(tabName) {
            // Ocultar todos los tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Mostrar tab seleccionado
            document.getElementById(`${tabName}-tab`).classList.add('active');
            event.target.classList.add('active');
        }

        // Funciones para ejemplos comunes
        function showCommonExamples() {
            const section = document.getElementById('commonExamplesSection');
            if (section.style.display === 'none' || section.style.display === '') {
                section.style.display = 'block';
                event.target.textContent = '🔽 Ocultar Ejemplos';
            } else {
                section.style.display = 'none';
                event.target.textContent = '💡 Ejemplos Comunes';
            }
        }

        function renderCommonExamples() {
            const container = document.querySelector('#commonExamplesSection .quick-examples');
            container.innerHTML = '';

            Object.entries(examples).forEach(([key, example]) => {
                const exampleItem = document.createElement('div');
                exampleItem.className = 'example-item';
                
                const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                
                exampleItem.innerHTML = `
                    <h4>${getExampleIcon(key)} ${title}</h4>
                    <div class="example-desc">
                        ${getExampleDescription(key)}
                    </div>
                    <div class="example-query">
                        ${generateExampleQuery(example)}
                    </div>
                    <button class="btn btn-primary btn-small use-example-btn" onclick="loadExample('${key}')">
                        Cargar este ejemplo
                    </button>
                `;
                
                container.appendChild(exampleItem);
            });
        }

        function getExampleIcon(key) {
            const icons = {
                breastCancer: '🔬',
                diabetesMeta: '📊',
                alzheimer: '🧠',
                covidVaccine: '💊',
                lungCancer: '🧬',
                exerciseMental: '🏃‍♂️'
            };
            return icons[key] || '📝';
        }

        function getExampleDescription(key) {
            const descriptions = {
                breastCancer: 'Búsqueda básica sobre cáncer de mama y tratamientos de quimioterapia',
                diabetesMeta: 'Meta-análisis y revisiones sistemáticas sobre diabetes de los últimos años',
                alzheimer: 'Artículos sobre Alzheimer en humanos, publicados en inglés',
                covidVaccine: 'Ensayos clínicos sobre COVID-19 y vacunas, con texto completo gratuito',
                lungCancer: 'Estudios genéticos sobre cáncer de pulmón en ratones',
                exerciseMental: 'Revisión de estudios sobre ejercicio y depresión/ansiedad'
            };
            return descriptions[key] || 'Ejemplo de búsqueda en PubMed';
        }

        function generateExampleQuery(example) {
            let query = '';
            
            example.terms.forEach((term, index) => {
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
            
            return query;
        }

        function loadExample(exampleKey) {
            const example = examples[exampleKey];
            if (!example) return;
            
            // Cargar términos
            terms = JSON.parse(JSON.stringify(example.terms));
            renderTerms();
            
            // Cargar otros valores
            document.getElementById('species').value = example.species;
            document.getElementById('language').value = example.language;
            
            // Cargar tipos de artículo
            document.querySelectorAll('#articleTypes input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = example.articleTypes.includes(checkbox.value);
            });
            
            // Cargar filtros de acceso
            document.getElementById('freeFullText').checked = example.freeFullText;
            document.getElementById('openAccess').checked = example.openAccess;
            document.getElementById('abstract').checked = example.abstract;
            
            // Actualizar query
            updateQuery();
            
            // Cerrar modal si está abierto
            closeGuide();
            
            // Mostrar mensaje
            alert('✅ Ejemplo cargado. Revisa los filtros y ajusta según necesites.');
        }

        // Event listeners
        document.getElementById('dateFrom').addEventListener('change', updateQuery);
        document.getElementById('dateTo').addEventListener('change', updateQuery);
        document.getElementById('species').addEventListener('input', updateQuery);
        document.getElementById('language').addEventListener('change', updateQuery);

        // Cerrar modal al hacer clic fuera
        document.getElementById('guideModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeGuide();
            }
        });

        // Cerrar modal con Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.getElementById('guideModal').style.display === 'block') {
                closeGuide();
            }
        });

        // Inicializar
        init();