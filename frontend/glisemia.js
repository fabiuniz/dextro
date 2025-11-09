        // Defina a URL do seu Apps Script e o token de segurança aqui.
        const GOOGLE_SHEETS_APP_SCRIPT_URL = getConfigValue(KEY_APP,false);
        const TOKEN_SECRETO = getConfigValue(KEY_APP,true);        

        // Sistema de controle de sincronização
        let registrosSincronizados = new Set();
        let ultimaSincronizacao = null;

        function gerarIdUnico() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        // Função para formatar data no padrão brasileiro (DD/MM/AAAA)
        function formatarDataBR(dataISO) {
            if (!dataISO) return '';
            try {
                // Se já estiver no formato brasileiro, retorna como está
                if (dataISO.includes('/')) return dataISO;
                
                const data = new Date(dataISO);
                if (isNaN(data.getTime())) return dataISO; // Se não for uma data válida, retorna original
                
                // Usa os métodos UTC para ignorar o fuso horário local
                const dia = data.getUTCDate().toString().padStart(2, '0');
                const mes = (data.getUTCMonth() + 1).toString().padStart(2, '0');
                const ano = data.getUTCFullYear();
                
                return `${dia}/${mes}/${ano}`;
            } catch (e) {
                return dataISO;
            }
        }

        // Função para converter data brasileira para ISO
        function dataParaISO(dataBR) {
            if (!dataBR) return '';
            try {
                // Se já estiver no formato ISO, retorna como está
                if (dataBR.includes('-')) return dataBR;
                
                // Converte de brasileiro para ISO
                const partes = dataBR.split('/');
                if (partes.length === 3) {
                    return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                }
                return dataBR;
            } catch (e) {
                return dataBR;
            }
        }

        // Função para formatar hora (HH:MM)
        function formatarHora(horaString) {
            if (!horaString) return '';
            
            // Se já estiver no formato HH:MM, retorna como está
            if (horaString.match(/^\d{2}:\d{2}$/)) return horaString;
            
            try {
                // Tenta converter de diferentes formatos
                let data;
                
                // Se for um timestamp ou string de data completa
                if (horaString.includes('T') || horaString.includes('Z') || !isNaN(Date.parse(horaString))) {
                    data = new Date(horaString);
                } else {
                    // Se for apenas uma hora
                    data = new Date(`1970-01-01T${horaString}`);
                }
                
                if (isNaN(data.getTime())) return horaString;
                
                return data.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            } catch (e) {
                return horaString;
            }
        }

        function toggleFormulario() {
            atualizarDataHora();
            const formContainer = document.getElementById('form-container');
            const toggleButton = document.getElementById('form-toggle');
            
            formContainer.classList.toggle('active');
            toggleButton.classList.toggle('active');
            
            if (formContainer.classList.contains('active')) {
                toggleButton.textContent = '✖️';
                // Impede scroll do body quando modal está aberto
                document.body.style.overflow = 'hidden';
            } else {
                toggleButton.textContent = '➕';
                document.body.style.overflow = '';
            }
        }

        function adicionarRegistro() {
            const tabela = document.querySelector("#tabela-registros tbody");
            const dataInput = document.getElementById("data");
            const horaInput = document.getElementById("hora");
            const momentoInput = document.getElementById("momento");
            const febreInput = document.getElementById("febre");
            const dextroInput = document.getElementById("dextro");

            // Pega a data no formato ISO e converte para brasileiro para exibição
            let dataISO = dataInput.value || new Date().toISOString().slice(0, 10);
            let dataBR = formatarDataBR(dataISO);
            
            let hora = horaInput.value || new Date().toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });

            if (!dextroInput.value) {
                alert("Por favor, preencha o campo dextro.");
                return;
            }

            const novaLinha = document.createElement("tr");
            const dextroValue = parseInt(dextroInput.value);
            const badgeClass = getBadgeClass(dextroValue);
            const idUnico = gerarIdUnico();

            novaLinha.innerHTML = `
                <td title='${obterDiaDaSemana(dataISO)}' data-tooltip='${dataBR} ${obterDiaDaSemana(dataISO)}' class='linkfortooltip'>${dataBR}</td>
                <td>${hora}</td>
                <td>${momentoInput.value}</td>
                <td>${febreInput.value}</td>
                <td><span class="badge ${badgeClass}">${dextroValue}</span></td>
                <td data-id="${idUnico}"><span class="badge badge-warning">⏳ Pendente</span></td>
                <td><button class="btn btn-danger btn-sm" title="Remover" onclick="removerRegistro(this)">❌</button></td>
            `;

            tabela.appendChild(novaLinha);
            classificarTabelaPorDataHora(tabela);
            salvarNoLocalStorage();
            adicionarListenerMap();
            atualizarStatusSincronizacao();

            // Limpa o formulário e o fecha após adicionar
            document.getElementById("data").value = "";
            document.getElementById("hora").value = "";
            document.getElementById("momento").selectedIndex = 0;
            document.getElementById("febre").selectedIndex = 0;
            document.getElementById("dextro").value = "";

            // Fecha o formulário automaticamente
            toggleFormulario();

            // Feedback visual
            showNotification('Registro adicionado com sucesso!', 'success');
        }

        function getBadgeClass(dextroValue) {
            const dextroNum = parseInt(dextroValue);
            if (dextroNum > 250) return 'badge-critical';
            if (dextroNum > 180) return 'badge-danger';
            if (dextroNum > 140) return 'badge-warning';
            if (dextroNum > 70) return 'badge-success';
            return 'badge-low';
        }

        function removerRegistro(botao) {
            if (confirm("Tem certeza de que deseja remover este registro?")) {
                const linha = botao.parentElement.parentElement;
                const idRegistro = linha.querySelector('td[data-id]').getAttribute('data-id');

                // Remove da lista de sincronizados se estiver lá
                registrosSincronizados.delete(idRegistro);

                linha.remove();
                salvarNoLocalStorage();
                atualizarStatusSincronizacao();
                showNotification('Registro removido com sucesso!', 'info');
            }
        }

        function classificarTabelaPorDataHora(tabela) {
            if (!tabela) {
                console.log('Tabela não encontrada');
                return;
            }
            
            const tbody = tabela.querySelector('tbody');
            if (!tbody) {
                console.log('tbody não encontrado');
                return;
            }
            
            if (!tbody.rows || tbody.rows.length === 0) {
                console.log('Nenhuma linha para ordenar');
                return;
            }
            
            const linhas = Array.from(tbody.rows);
            
            linhas.sort((a, b) => {
                try {
                    const dataHoraA = obterDataHoraParaOrdenacao(a.cells[0].textContent, a.cells[1].textContent);
                    const dataHoraB = obterDataHoraParaOrdenacao(b.cells[0].textContent, b.cells[1].textContent);
                    return dataHoraB - dataHoraA; // Ordem decrescente (mais recente primeiro)
                } catch (error) {
                    console.log('Erro ao ordenar linha:', error);
                    return 0;
                }
            });
            
            // Remove todas as linhas primeiro
            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }
            
            // Reinsere as linhas ordenadas
            linhas.forEach(linha => tbody.appendChild(linha));
        }

        function obterDataHoraParaOrdenacao(dataTexto, horaTexto) {
            try {
                // Converte data brasileira para ISO se necessário
                const dataISO = dataParaISO(dataTexto);
                return new Date(`${dataISO}T${horaTexto}`);
            } catch (e) {
                return new Date();
            }
        }

        function salvarNoLocalStorage() {
            const registros = [];
            const linhas = document.querySelectorAll("#tabela-registros tbody tr");

            linhas.forEach(linha => {
                const colunas = linha.querySelectorAll("td");
                const idRegistro = colunas[5].getAttribute('data-id');

                // Salva a data em formato ISO para consistência
                const dataBR = colunas[0].textContent;
                const dataISO = dataParaISO(dataBR);

                // CORREÇÃO: Preserva o status de sincronização corretamente
                const estaSincronizado = registrosSincronizados.has(idRegistro);

                registros.push({
                    id: idRegistro,
                    data: dataISO, // Salva em formato ISO
                    hora: formatarHora(colunas[1].textContent),
                    momento: colunas[2].textContent,
                    febre: colunas[3].textContent,
                    dextro: colunas[4].textContent.replace(/\s+/g, '').replace(/[^\d]/g, ''), // Remove tudo exceto números
                    sincronizado: estaSincronizado // CORREÇÃO: Usa o valor correto do Set
                });
            });

            localStorage.setItem("registrosGlicemia", JSON.stringify(registros));
            localStorage.setItem("registrosSincronizados", JSON.stringify([...registrosSincronizados]));
            if (ultimaSincronizacao) {
                localStorage.setItem("ultimaSincronizacao", ultimaSincronizacao);
            }
            atualizarEstatisticas();
        }

        function carregarDoLocalStorage() {
            // Verifica se a tabela existe no DOM
            const tabela = document.querySelector("#tabela-registros");
            if (!tabela) {
                console.log('Tabela ainda não carregada, aguardando...');
                // Reagenda para executar quando o DOM estiver pronto
                setTimeout(carregarDoLocalStorage, 100);
                return;
            }
            
            const tbody = tabela.querySelector('tbody');
            if (!tbody) {
                console.log('tbody ainda não carregado, aguardando...');
                setTimeout(carregarDoLocalStorage, 100);
                return;
            }

            const registros = JSON.parse(localStorage.getItem("registrosGlicemia")) || [];
            const sincronizados = JSON.parse(localStorage.getItem("registrosSincronizados")) || [];
            const ultimaSync = localStorage.getItem("ultimaSincronizacao");

            registrosSincronizados = new Set(sincronizados);
            ultimaSincronizacao = ultimaSync;

            tbody.innerHTML = '';

            registros.forEach(registro => {
                const novaLinha = document.createElement("tr");

                // Formata data e hora corretamente
                const dataBR = formatarDataBR(registro.data);
                const horaFormatada = formatarHora(registro.hora);
                const dataISO = dataParaISO(dataBR);

                const strtool = `${dataBR} ${obterDiaDaSemana(dataISO)}`;
                const dextroValue = parseInt(registro.dextro);
                const badgeClass = getBadgeClass(dextroValue);

                const statusBadge = registro.sincronizado ? 
                    '<span class="badge badge-success">✅ Sincro..</span>' : 
                    '<span class="badge badge-warning">⏳ Pendente</span>';

                novaLinha.innerHTML = `
                    <td title='${obterDiaDaSemana(dataISO)}' data-tooltip='${strtool}' class='linkfortooltip'>${dataBR}</td>
                    <td>${horaFormatada}</td>
                    <td>${registro.momento}</td>
                    <td>${registro.febre}</td>
                    <td><span class="badge ${badgeClass}">${registro.dextro}</span></td>
                    <td data-id="${registro.id}">${statusBadge}</td>
                    <td><button class="btn btn-danger btn-sm" title="Remover" onclick="removerRegistro(this)">❌</button></td>
                `;
                tbody.appendChild(novaLinha);
            });

            // Só chama a classificação se houver registros e a tabela estiver pronta
            if (registros.length > 0) {
                classificarTabelaPorDataHora(tabela);
            }
            
            adicionarListenerMap();
            atualizarEstatisticas();
            atualizarStatusSincronizacao();
        }

        function obterRegistrosPendentes() {
            const registros = JSON.parse(localStorage.getItem("registrosGlicemia")) || [];
            
            // CORREÇÃO: Filtra corretamente usando o Set de sincronizados
            return registros.filter(registro => {
                const estaSincronizado = registrosSincronizados.has(registro.id);
                return !estaSincronizado;
            });
        }

        async function sincronizarIncrementalComGoogleSheets() {
            if (GOOGLE_SHEETS_APP_SCRIPT_URL === '') {
                showNotification('Atenção: Você precisa configurar a integração com o Google Sheets primeiro!');
                return;
            }

            const registrosPendentes = obterRegistrosPendentes();

            if (registrosPendentes.length === 0) {
                showNotification('Não há registros pendentes para sincronizar.');
                return;
            }

            if (!confirm(`Isso irá enviar ${registrosPendentes.length} registros novos para o Google Sheets. Deseja continuar?`)) {
                return;
            }

            const loadingMessage = document.getElementById('loading-message');
            const loadingOverlay = document.getElementById('loading-overlay');
            loadingOverlay.style.display = 'flex';
            atualizarStatusSincronizacao('syncing');

            try {
                const MAX_CHUNKS_POR_LOTE = 20;
                const CHUNK_SIZE = 1500;
                const jsonString = JSON.stringify(registrosPendentes);
                const totalChunks = Math.ceil(jsonString.length / CHUNK_SIZE);

                console.log(`Total de Partes: ${totalChunks}`);

                if (totalChunks <= MAX_CHUNKS_POR_LOTE) {
                    await enviarLoteCompleto(jsonString, registrosPendentes, loadingMessage);
                    
                    // CORREÇÃO: Marca todos os registros como sincronizados APÓS o envio bem-sucedido
                    registrosPendentes.forEach(registro => {
                        registrosSincronizados.add(registro.id);
                        
                        // CORREÇÃO: Atualiza o DOM imediatamente
                        const statusCell = document.querySelector(`td[data-id="${registro.id}"]`);
                        if (statusCell) {
                            statusCell.innerHTML = '<span class="badge badge-success">✅ Sincro..</span>';
                        }
                    });

                } else {
                    // Sistema de lotes para muitos chunks
                    let totalRegistrosEnviados = 0;
                    const registrosPorLote = Math.ceil(registrosPendentes.length / Math.ceil(totalChunks / MAX_CHUNKS_POR_LOTE));

                    for (let loteIndex = 0; loteIndex < registrosPendentes.length; loteIndex += registrosPorLote) {
                        const lote = registrosPendentes.slice(loteIndex, loteIndex + registrosPorLote);
                        const numeroLote = Math.floor(loteIndex / registrosPorLote) + 1;
                        const totalLotes = Math.ceil(registrosPendentes.length / registrosPorLote);

                        loadingMessage.textContent = `Enviando lote ${numeroLote} de ${totalLotes} (${lote.length} registros)...`;

                        try {
                            await enviarLoteCompleto(JSON.stringify(lote), lote, loadingMessage, numeroLote, totalLotes);

                            // CORREÇÃO: Marca registros como sincronizados APENAS após sucesso
                            lote.forEach(registro => {
                                registrosSincronizados.add(registro.id);
                                
                                // Atualiza o DOM para cada registro do lote
                                const statusCell = document.querySelector(`td[data-id="${registro.id}"]`);
                                if (statusCell) {
                                    statusCell.innerHTML = '<span class="badge badge-success">✅ Sincro..</span>';
                                }
                            });

                            totalRegistrosEnviados += lote.length;

                            console.log(`Lote ${numeroLote} enviado com sucesso (${lote.length} registros)`);

                            if (numeroLote < totalLotes) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }

                        } catch (error) {
                            console.log(`Erro no lote ${numeroLote}:`, error);

                            if (totalRegistrosEnviados > 0) {
                                // CORREÇÃO: Salva apenas os registros que foram enviados com sucesso
                                salvarNoLocalStorage();
                                atualizarStatusSincronizacao('synced');
                                showNotification(`Sincronização parcial: ${totalRegistrosEnviados} de ${registrosPendentes.length} registros enviados.\n\nErro no lote ${numeroLote}: ${error.message}\n\nTente sincronizar novamente para enviar os registros restantes.`);
                            } else {
                                atualizarStatusSincronizacao('error');
                                showNotification(`Erro na sincronização: ${error.message}`);
                            }
                            return;
                        }
                    }
                }
                
                // CORREÇÃO: Atualiza timestamp e salva APENAS após todos os envios
                ultimaSincronizacao = new Date().toISOString();
                salvarNoLocalStorage();
                atualizarStatusSincronizacao('synced');
                
                showNotification(`Sincronização concluída! ${registrosPendentes.length} registros foram enviados com sucesso.`);
                toggleFormulario(); // Fecha o formulário automaticamente

            } catch (error) {
                console.log('Erro geral na sincronização:', error);
                atualizarStatusSincronizacao('error');
                alert(`Erro ao sincronizar dados: ${error.message}`);
            } finally {
                loadingOverlay.style.display = 'none';
            }
        }

        async function enviarLoteCompleto(jsonString, registrosDoLote, loadingMessage, numeroLote = 1, totalLotes = 1) {
            const CHUNK_SIZE = 1500;
            const totalChunks = Math.ceil(jsonString.length / CHUNK_SIZE);

            console.log(`Enviando lote ${numeroLote}/${totalLotes} - ${totalChunks} chunks, ${registrosDoLote.length} registros`);

            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = start + CHUNK_SIZE;
                const chunk = jsonString.substring(start, end);

                const params = new URLSearchParams();
                params.append('chunk', chunk);
                params.append('chunkIndex', i);
                params.append('totalChunks', totalChunks);
                params.append('token', TOKEN_SECRETO);
                params.append('incremental', 'true');

                const urlComDados = `${GOOGLE_SHEETS_APP_SCRIPT_URL}?${params.toString()}`;

                const statusTexto = totalLotes > 1 
                ? `Lote ${numeroLote}/${totalLotes} - Parte ${i + 1}/${totalChunks}`
                : `Enviando Parte ${i + 1} de ${totalChunks}...`;

                loadingMessage.textContent = statusTexto;
                console.log(statusTexto);

                const response = await fetch(urlComDados, {
                    method: 'GET',
                    mode: 'cors'
                });

                const result = await response.json();

                if (result.status !== 'success') {
                    throw new Error(`Erro no chunk ${i + 1}: ${result.message}`);
                }

                if ((i + 1) % 5 === 0 || i === totalChunks - 1) {
                    console.log(`Progresso do lote ${numeroLote}: ${i + 1}/${totalChunks} chunks enviados`);
                }
            }
        }

        async function carregarDadosDoGoogleSheets() {
            const loadingOverlay = document.getElementById('loading-overlay');
            const loadingMessage = document.getElementById('loading-message');

            if (!GOOGLE_SHEETS_APP_SCRIPT_URL || GOOGLE_SHEETS_APP_SCRIPT_URL === '') {
                showNotification('Atenção: Você precisa configurar a integração com o Google Sheets primeiro!', 'warning');
                return;
            }

            if (!confirm('Isso irá substituir todos os dados locais pelos dados do Google Sheets. Deseja continuar?')) {
                return;
            }

            loadingOverlay.style.display = 'flex';

            // Função auxiliar para criar um pequeno atraso
            const delay = ms => new Promise(res => setTimeout(res, ms));

            try {
                loadingMessage.innerText = 'Buscando dados na planilha...';
                await delay(500); // Adiciona um pequeno atraso para a mensagem ser visível

                const url = `${GOOGLE_SHEETS_APP_SCRIPT_URL}?token=${TOKEN_SECRETO}&carregarPlanilha=true`;
                const response = await fetch(url, { method: 'GET', mode: 'cors' });
                const result = await response.json();

                if (result.status !== 'success') {
                    throw new Error(result.message);
                }

                loadingMessage.innerText = 'Dados recebidos! Processando os registros...';
                await delay(500); // Outro pequeno atraso

                const registrosComId = result.data.map(registro => ({
                    ...registro,
                    id: gerarIdUnico(),
                    data: dataParaISO(registro.data),
                    hora: formatarHora(registro.hora),
                    sincronizado: true
                }));
                
                loadingMessage.innerText = 'Salvando dados localmente...';
                await delay(500); // Outro pequeno atraso

                registrosSincronizados = new Set(registrosComId.map(r => r.id));
                ultimaSincronizacao = new Date().toISOString();

                localStorage.setItem("registrosGlicemia", JSON.stringify(registrosComId));
                localStorage.setItem("registrosSincronizados", JSON.stringify([...registrosSincronizados]));
                localStorage.setItem("ultimaSincronizacao", ultimaSincronizacao);

                loadingMessage.innerText = 'Tudo pronto! Atualizando a tela...';
                await delay(500); // E um último atraso antes de fechar

                carregarDoLocalStorage();
                showNotification(`${registrosComId.length} registros carregados do Google Sheets com sucesso!`);
                toggleFormulario();

            } catch (error) {
                console.log('Erro ao carregar dados:', error);
                showNotification(`Erro ao carregar dados do Google Sheets: ${error.message}`, 'error');
            } finally {
                loadingMessage.innerText = 'Sincronizando...'; // Reseta a mensagem
                loadingOverlay.style.display = 'none';
            }
        }

        function atualizarStatusSincronizacao(status = null) {
            const statusElement = document.getElementById('sync-status');
            const pendingSyncElement = document.getElementById('pending-sync');
            const registrosPendentes = obterRegistrosPendentes();

            // CORREÇÃO: Atualiza o contador correto de pendentes
            if (pendingSyncElement) {
                pendingSyncElement.textContent = registrosPendentes.length;
            }

            if (status === 'syncing') {
                statusElement.className = 'sync-status pending';
                statusElement.textContent = '🔄 Sincronizando...';
            } else if (status === 'synced') {
                statusElement.className = 'sync-status synced';
                statusElement.textContent = '✅ Sincronizado';
            } else if (status === 'error') {
                statusElement.className = 'sync-status error';
                statusElement.textContent = '❌ Erro na sincronização';
            } else {
                // CORREÇÃO: Lógica de status automático aprimorada
                if (registrosPendentes.length > 0) {
                    statusElement.className = 'sync-status pending';
                    statusElement.textContent = `⏳ ${registrosPendentes.length} pendente(s)`;
                } else if (ultimaSincronizacao) {
                    statusElement.className = 'sync-status synced';
                    const dataSync = formatarDataHoraCurta(ultimaSincronizacao);
                    statusElement.textContent = `✅ ${dataSync}`;
                } else {
                    statusElement.className = 'sync-status pending';
                    statusElement.textContent = '⏸️ Nunca sincronizado';
                }
            }
        }

        function formatarDataHoraCurta(isoString) {
            try {
                const data = new Date(isoString);
                return data.toLocaleString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (e) {
                return 'Erro na data';
            }
        }

        function exportarDados() {
            const registros = localStorage.getItem("registrosGlicemia");
            if (!registros || registros === '[]') {
                showNotification('Não há dados para exportar.', 'warning');
                return;
            }

            const blob = new Blob([registros], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            const dataAtual = new Date().toISOString().slice(0, 10);
            a.download = `dados_glicemia_${dataAtual}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification('Dados exportados com sucesso!', 'success');
        }

        function importarDados() {
            const inputFile = document.getElementById("import-file");
            inputFile.click();
        }

        function carregarArquivo(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = function (e) {
                try {
                    const registros = JSON.parse(e.target.result);

                    if (!Array.isArray(registros)) {
                        throw new Error('Formato de arquivo inválido.');
                    }

                    const registrosComId = registros.map(registro => ({
                        ...registro,
                        id: registro.id || gerarIdUnico(),
                        data: dataParaISO(registro.data), // Normaliza formato da data
                        hora: formatarHora(registro.hora), // Normaliza formato da hora
                        sincronizado: registro.sincronizado || false
                    }));

                    localStorage.setItem("registrosGlicemia", JSON.stringify(registrosComId));

                    registrosSincronizados = new Set(
                        registrosComId
                            .filter(r => r.sincronizado)
                            .map(r => r.id)
                    );
                    localStorage.setItem("registrosSincronizados", JSON.stringify([...registrosSincronizados]));

                    carregarDoLocalStorage();
                    showNotification(`${registrosComId.length} registros importados com sucesso!`, 'success');
                } catch (error) {
                    showNotification(`Erro ao importar dados: ${error.message}`, 'error');
                }
            };

            reader.readAsText(file);
        }

        function filtrarRegistros() {
            const input = document.getElementById('filterInput');
            const filter = input.value.toLowerCase();
            const tabela = document.getElementById('tabela-registros');
            const tr = tabela.getElementsByTagName('tr');
            let registrosVisiveis = [];
            let totalVisiveis = 0;

            for (let i = 1; i < tr.length; i++) {
                const td = tr[i].getElementsByTagName('td');
                let rowContainsFilter = false;

                for (let j = 0; j < td.length; j++) {
                    if (td[j]) {
                        const txtValue = td[j].textContent || td[j].innerText;
                        if (txtValue.toLowerCase().indexOf(filter) > -1) {
                            rowContainsFilter = true;
                            break;
                        }
                    }
                }

                if (rowContainsFilter) {
                    tr[i].style.display = "";
                    totalVisiveis++;

                    const dextroCell = td[4];
                    if (dextroCell) {
                        const dextroText = dextroCell.textContent || dextroCell.innerText;
                        const dextroValue = parseInt(dextroText.replace(/\D/g, ''));
                        if (!isNaN(dextroValue)) {
                            registrosVisiveis.push(dextroValue);
                        }
                    }
                } else {
                    tr[i].style.display = "none";
                }
            }

            atualizarEstatisticasFiltradas(registrosVisiveis, totalVisiveis);
        }

        function atualizarEstatisticasFiltradas(valoresDextro, totalVisiveis) {
            const filteredCountEl = document.getElementById("total-records");
            const filteredAvgEl = document.getElementById("filtered-avg");

            const totalRegistros = JSON.parse(localStorage.getItem("registrosGlicemia")) || [];
            
            if (totalVisiveis === totalRegistros.length) {
                filteredCountEl.textContent = totalRegistros.length;
            } else {
                filteredCountEl.textContent = `${totalVisiveis}/${totalRegistros.length}`;
            }

            if (valoresDextro.length > 0) {
                const soma = valoresDextro.reduce((acc, valor) => acc + valor, 0);
                const mediaFiltrada = (soma / valoresDextro.length).toFixed(0);
                filteredAvgEl.textContent = mediaFiltrada;

                const mediaGeral = parseInt(document.getElementById("avg-glucose").textContent);
                if (parseInt(mediaFiltrada) !== mediaGeral) {
                    filteredAvgEl.style.color = 'var(--warning)';
                } else {
                    filteredAvgEl.style.color = 'var(--primary)';
                }
            } else {
                filteredAvgEl.textContent = "0";
                filteredAvgEl.style.color = 'var(--primary)';
            }
        }

        function limparFiltro() {
            const input = document.getElementById('filterInput');
            input.value = '';
            filtrarRegistros();
        }
        function imprimirTabela() {
          // ⚠️ Use a nova ponte JavaScript-Android ⚠️
          // A chamada abaixo vai acionar o diálogo de impressão no Android
          AndroidInterface.printPage(); 
        }
        function _imprimirTabela() {
            window.print();
        }

        function abrirAnalises() {
            window.open('data_cientist.html', '_blank');
        }

        function limparTodosDados() {
            if (confirm("ATENÇÃO: Esta ação irá apagar TODOS os registros salvos no seu navegador. Tem certeza que deseja continuar?")) {
                localStorage.removeItem("registrosGlicemia");
                localStorage.removeItem("registrosSincronizados");
                localStorage.removeItem("ultimaSincronizacao");
                registrosSincronizados.clear();
                ultimaSincronizacao = null;
                carregarDoLocalStorage();
                showNotification('Todos os dados foram apagados com sucesso!', 'info');
            }
        }

        function obterDiaDaSemana(dataString) {
            try {
                const data = new Date(dataString + 'T00:00:00');
                const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                return diasDaSemana[data.getDay()];
            } catch (e) {
                return '';
            }
        }

        function mostrarTooltip(event) {
            const tooltip = document.getElementById('tooltip');
            const mensagem = event.getAttribute('data-tooltip');
            tooltip.textContent = mensagem;

            const rect = event.getBoundingClientRect();
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            tooltip.style.top = rect.bottom + scrollTop + 5 + 'px';
            tooltip.style.left = rect.left + scrollLeft + 'px';
            tooltip.style.opacity = '1';
            tooltip.style.visibility = 'visible';
            tooltip.style.transform = 'translateY(0)';

            // Auto-hide tooltip after 3 seconds
            setTimeout(() => {
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
                tooltip.style.transform = 'translateY(-10px)';
            }, 3000);
        }

        function adicionarListenerMap() {
            const eletooltip = document.querySelectorAll('.linkfortooltip');
            eletooltip.forEach(elemento => {
                elemento.addEventListener('click', function() {
                    mostrarTooltip(elemento);
                });
            });
        }

        function atualizarEstatisticas() {
            const registros = JSON.parse(localStorage.getItem("registrosGlicemia")) || [];
            const totalRecordsEl = document.getElementById("total-records");
            const avgGlucoseEl = document.getElementById("avg-glucose");
            const lastRecordEl = document.getElementById("last-record");

            totalRecordsEl.textContent = registros.length;

            if (registros.length > 0) {
                const sum = registros.reduce((acc, curr) => acc + parseInt(curr.dextro), 0);
                const avg = (sum / registros.length).toFixed(0);
                avgGlucoseEl.textContent = avg;

                // Pega o último registro baseado na data/hora
                const registrosOrdenados = registros.sort((a, b) => {
                    const dataHoraA = new Date(`${a.data}T${a.hora}`);
                    const dataHoraB = new Date(`${b.data}T${b.hora}`);
                    return dataHoraB - dataHoraA;
                });

                const last = registrosOrdenados[registrosOrdenados.length-1];
                lastRecordEl.textContent = `${last.dextro}`;
            } else {
                avgGlucoseEl.textContent = "0";
                lastRecordEl.textContent = "-";
            }

            // Inicializa as estatísticas filtradas (mostra todas inicialmente)
            const valoresDextro = registros.map(r => parseInt(r.dextro));
            atualizarEstatisticasFiltradas(valoresDextro, registros.length);
        }

        function atualizarDataHora() {
            // Cria um novo objeto de data para obter a data e hora atuais
            const agora = new Date();

            // Formata a data para o formato 'YYYY-MM-DD' (ISO)
            const dataFormatada = agora.toISOString().slice(0, 10);

            // Formata a hora para o formato 'HH:MM'
            const horaFormatada = agora.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            // Encontra os elementos de input pelo ID e atualiza os valores
            document.getElementById('data').value = dataFormatada;
            document.getElementById('hora').value = horaFormatada;
        }

        function toggleStats() {
            const statsGrid = document.getElementById("stats-grid");
            const toggleBtn = document.querySelector(".stats-toggle");
            
            if (statsGrid.style.display === "none") {
                statsGrid.style.display = "grid";
                toggleBtn.textContent = "📊 Ocultar";
            } else {
                statsGrid.style.display = "none";
                toggleBtn.textContent = "📊 Estatísticas";
            }
        }

        // Sistema de notificações
        function showNotification(message, type = 'info') {
            // Remove notificação existente se houver
            const existingNotification = document.querySelector('.notification');
            if (existingNotification) {
                existingNotification.remove();
            }

            // Cria nova notificação
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                font-size: 14px;
                z-index: 9999;
                max-width: 300px;
                word-wrap: break-word;
                box-shadow: var(--shadow-lg);
                transform: translateX(100%);
                transition: transform 0.3s ease;
            `;

            // Define cor baseada no tipo
            switch(type) {
                case 'success':
                    notification.style.background = 'var(--success)';
                    break;
                case 'error':
                    notification.style.background = 'var(--danger)';
                    break;
                case 'warning':
                    notification.style.background = 'var(--warning)';
                    break;
                default:
                    notification.style.background = 'var(--info)';
            }

            notification.textContent = message;
            document.body.appendChild(notification);

            // Animação de entrada
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);

            // Remove após 4 segundos
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 4000);
        }

        // Event listeners para fechar modal
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                const formContainer = document.getElementById('form-container');
                if (formContainer.classList.contains('active')) {
                    toggleFormulario();
                }
            }
        });

        // Impede o scroll do background quando modal está aberto
        document.getElementById('form-container').addEventListener('touchmove', function(e) {
            e.preventDefault();
        }, { passive: false });

        // Inicialização da aplicação
        function inicializarApp() {
            // Aguarda o DOM estar completamente carregado
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', inicializarApp);
                return;
            }
            
            carregarDoLocalStorage();
            
            // Define data e hora atual por padrão
            atualizarDataHora();
            
            // Resto do código de inicialização...
            window.addEventListener('orientationchange', function() {
                setTimeout(() => {
                    const statsGrid = document.getElementById("stats-grid");
                    if (window.innerWidth < window.innerHeight && window.innerWidth <= 768) {
                        statsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
                    } else if (window.innerWidth > window.innerHeight && window.innerWidth <= 768) {
                        statsGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
                    }
                }, 500);
            });

            window.addEventListener('resize', debounce(() => {
                ajustarLayoutResponsivo();
            }, 250));

            if (window.matchMedia('(display-mode: standalone)').matches) {
                document.body.classList.add('pwa-mode');
            }

            setInterval(() => {
                const registros = JSON.parse(localStorage.getItem("registrosGlicemia")) || [];
                if (registros.length > 0) {
                    const ultimoBackup = localStorage.getItem("ultimoBackup");
                    const agora = Date.now();
                    
                    if (!ultimoBackup || (agora - parseInt(ultimoBackup)) > 30000) {
                        localStorage.setItem("ultimoBackup", agora.toString());
                        console.log('Auto-save realizado');
                    }
                }
            }, 30000);
        }

        // Função para ajustar layout responsivo baseado no tamanho da tela
        function ajustarLayoutResponsivo() {
            const container = document.querySelector('.container');
            const statsGrid = document.getElementById("stats-grid");
            const formContainer = document.getElementById('form-container');
/*            
            if (window.innerWidth <= 480) {
                // Mobile pequeno
                container.style.paddingTop = '200px';
                statsGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
                
                // Ajusta altura do modal em mobile
                if (formContainer) {
                    formContainer.style.height = '100vh';
                }
            } else if (window.innerWidth <= 768) {
                // Tablet/Mobile grande
                container.style.paddingTop = '220px';
                
                if (window.innerWidth > window.innerHeight) {
                    // Landscape
                    statsGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
                } else {
                    // Portrait
                    statsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
                }
            } else {
                // Desktop
                container.style.paddingTop = '200px';
                statsGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
            }
            */
        }

        // Função debounce para otimizar performance
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // Função para detectar swipe gestures no mobile
        function adicionarGestosSwipe() {
            let startY = 0;
            let startX = 0;

            // Define o tempo de atraso para o swipe para baixo em milissegundos
            const tempoAtraso = 500; // Altere este valor para o tempo desejado

            document.addEventListener('touchstart', function(e) {
                startY = e.touches[0].clientY;
                startX = e.touches[0].clientX;
            });

            document.addEventListener('touchend', function(e) {
                if (!startY || !startX) return;

                let endY = e.changedTouches[0].clientY;
                let endX = e.changedTouches[0].clientX;

                let diffY = startY - endY;
                let diffX = startX - endX;

                // Swipe vertical para mostrar/ocultar stats
                if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 50) {
                    const statsGrid = document.getElementById("stats-grid");
                    
                    if (diffY > 0) {
                        // Swipe up - oculta stats
                        if (statsGrid.style.display !== "none") {
                            toggleStats();
                        }
                    } else {
                        // Swipe down - mostra stats
                        if (statsGrid.style.display === "none") {
                            // Chama a função toggleStats() com um atraso
                            setTimeout(() => {
                                toggleStats();
                            }, tempoAtraso);
                        }
                    }
                }

                startY = 0;
                startX = 0;
            });
        }

        // Função para otimizar performance da tabela
        function otimizarTabela() {
            const tabela = document.getElementById('tabela-registros');
            const tbody = tabela.querySelector('tbody');
            
            // Implementa virtualização simples para muitos registros
            if (tbody.children.length > 100) {
                // Se houver mais de 100 registros, mostra apenas os primeiros 50
                // e adiciona botão "Carregar mais"
                const linhas = Array.from(tbody.children);
                
                linhas.slice(50).forEach(linha => {
                    linha.style.display = 'none';
                    linha.classList.add('linha-oculta');
                });

                // Adiciona botão "Carregar mais" se não existir
                if (!document.getElementById('carregar-mais')) {
                    const botaoCarregarMais = document.createElement('button');
                    botaoCarregarMais.id = 'carregar-mais';
                    botaoCarregarMais.className = 'btn btn-info';
                    botaoCarregarMais.style.width = '100%';
                    botaoCarregarMais.style.marginTop = '10px';
                    botaoCarregarMais.textContent = `📄 Carregar mais registros (${linhas.length - 50} restantes)`;
                    
                    botaoCarregarMais.addEventListener('click', function() {
                        const linhasOcultas = document.querySelectorAll('.linha-oculta');
                        const proximoLote = Array.from(linhasOcultas).slice(0, 50);
                        
                        proximoLote.forEach(linha => {
                            linha.style.display = '';
                            linha.classList.remove('linha-oculta');
                        });

                        const restantes = linhasOcultas.length - proximoLote.length;
                        if (restantes <= 0) {
                            botaoCarregarMais.remove();
                        } else {
                            botaoCarregarMais.textContent = `📄 Carregar mais registros (${restantes} restantes)`;
                        }
                    });

                    document.querySelector('.table-container').appendChild(botaoCarregarMais);
                }
            }
        }

        // Função para backup automático no Google Drive (se configurado)
        async function backupAutomatico() {
            const registros = JSON.parse(localStorage.getItem("registrosGlicemia")) || [];
            
            if (registros.length === 0) return;

            const ultimoBackup = localStorage.getItem("ultimoBackupAutomatico");
            const agora = Date.now();
            const umDiaEmMs = 24 * 60 * 60 * 1000; // 24 horas

            // Faz backup automático apenas uma vez por dia
            if (ultimoBackup && (agora - parseInt(ultimoBackup)) < umDiaEmMs) {
                return;
            }

            try {
                // Cria backup local adicional
                const backupData = {
                    registros: registros,
                    sincronizados: [...registrosSincronizados],
                    ultimaSincronizacao: ultimaSincronizacao,
                    timestamp: new Date().toISOString()
                };

                localStorage.setItem("backupAutomatico", JSON.stringify(backupData));
                localStorage.setItem("ultimoBackupAutomatico", agora.toString());
                
                console.log('Backup automático realizado com sucesso');
            } catch (error) {
                console.log('Erro no backup automático:', error);
            }
        }

        // Função para restaurar backup
        function restaurarBackup() {
            const backup = localStorage.getItem("backupAutomatico");
            
            if (!backup) {
                showNotification('Nenhum backup encontrado.', 'warning');
                return;
            }

            if (!confirm('Isso irá substituir todos os dados atuais pelo backup. Deseja continuar?')) {
                return;
            }

            try {
                const backupData = JSON.parse(backup);
                
                localStorage.setItem("registrosGlicemia", JSON.stringify(backupData.registros));
                localStorage.setItem("registrosSincronizados", JSON.stringify(backupData.sincronizados));
                if (backupData.ultimaSincronizacao) {
                    localStorage.setItem("ultimaSincronizacao", backupData.ultimaSincronizacao);
                }

                registrosSincronizados = new Set(backupData.sincronizados);
                ultimaSincronizacao = backupData.ultimaSincronizacao;

                carregarDoLocalStorage();
                
                const dataBackup = new Date(backupData.timestamp).toLocaleString('pt-BR');
                showNotification(`Backup restaurado com sucesso! Data: ${dataBackup}`, 'success');
            } catch (error) {
                showNotification(`Erro ao restaurar backup: ${error.message}`, 'error');
            }
        }

        // Adiciona função de restaurar backup ao menu (se necessário)
        function adicionarMenuBackup() {
            const buttonGrid = document.querySelector('.button-grid');
            if (buttonGrid && !document.getElementById('btn-restaurar-backup')) {
                const btnRestaurar = document.createElement('button');
                btnRestaurar.id = 'btn-restaurar-backup';
                btnRestaurar.className = 'btn btn-warning';
                btnRestaurar.innerHTML = '⚡ Restaurar Backup';
                btnRestaurar.addEventListener('click', restaurarBackup);
                
                // Adiciona antes do botão de limpar dados
                const btnLimpar = buttonGrid.querySelector('.btn-danger');
                if (btnLimpar) {
                    buttonGrid.insertBefore(btnRestaurar, btnLimpar);
                } else {
                    buttonGrid.appendChild(btnRestaurar);
                }
            }
        }

        // Função para detectar se está offline
        function verificarStatusOnline() {
            const statusElement = document.getElementById('sync-status');
            
            if (!navigator.onLine) {
                // Está offline
                if (statusElement.textContent.includes('Sincronizado') || statusElement.textContent.includes('Sincronizando')) {
                    statusElement.className = 'sync-status error';
                    statusElement.textContent = '📡 Offline - Sync pausada';
                }
            } else {
                // Está online - atualiza status normal
                atualizarStatusSincronizacao();
            }
        }

        // Event listeners para status online/offline
        window.addEventListener('online', () => {
            showNotification('Conexão restaurada!', 'success');
            atualizarStatusSincronizacao();
        });

        window.addEventListener('offline', () => {
            showNotification('Você está offline. Os dados serão salvos localmente.', 'warning');
            verificarStatusOnline();
        });

        // Função principal de inicialização
        window.onload = function() {
            inicializarApp();
            adicionarGestosSwipe();
            ajustarLayoutResponsivo();
            verificarStatusOnline();
            
            // Executa backup automático após 5 segundos
            setTimeout(backupAutomatico, 5000);
            
            // Adiciona menu de backup se houver registros
            setTimeout(() => {
                const registros = JSON.parse(localStorage.getItem("registrosGlicemia")) || [];
                if (registros.length > 10) {
                    adicionarMenuBackup();
                }
            }, 1000);

            // Otimiza tabela se houver muitos registros
            setTimeout(otimizarTabela, 1000);
            
            console.log('Sistema de Registro de Glicemia carregado com sucesso!');
            console.log('Versão: 2.0 - Layout Responsivo Otimizado');
        };

        // Service Worker para PWA (opcional)
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                // Registra service worker se disponível
                // navigator.serviceWorker.register('/sw.js')
                //   .then(registration => console.log('SW registered'))
                //   .catch(error => console.log('SW registration failed'));
            });
        }