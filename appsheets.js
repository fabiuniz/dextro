        //---------------------Colocar no googlesheets---------------------------------------

const SPREADSHEET_ID = '1psodaifoiasdfgsdjfjpoAl231cFtibpo'; 
const SHEET_NAME = 'glisemia'; 
const TOKEN_SECRETO = 'seu_token_secreto_e_forte'; 

function doGet(e) {
    try {
        const token = e.parameter.token;

        if (token !== TOKEN_SECRETO) {
            return ContentService.createTextOutput(JSON.stringify({
                status: 'error',
                message: 'Token de segurança inválido.'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // --- Lógica para carregar os dados da planilha ---
        if (e.parameter.carregarPlanilha === 'true') {
            const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
            if (!sheet) {
                return ContentService.createTextOutput(JSON.stringify({
                    status: 'error',
                    message: 'Aba não encontrada.'
                })).setMimeType(ContentService.MimeType.JSON);
            }

            const lastRow = sheet.getLastRow();
            if (lastRow <= 1) {
                return ContentService.createTextOutput(JSON.stringify({
                    status: 'success',
                    message: 'Planilha vazia.',
                    data: []
                })).setMimeType(ContentService.MimeType.JSON);
            }

            const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
            const values = range.getValues();

            const registros = values.map(row => ({
                data: row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT-3", "yyyy-MM-dd") : row[0].toString().trim(),
                hora: row[1] instanceof Date ? Utilities.formatDate(row[1], "GMT-3", "HH:mm") : row[1].toString().trim(),
                momento: row[2].toString().trim().toUpperCase(),
                febre: row[3].toString().trim().toUpperCase(),
                dextro: parseInt(row[4]).toString()
            }));

            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                message: 'Dados carregados com sucesso.',
                data: registros
            })).setMimeType(ContentService.MimeType.JSON);
        }
        // --- Fim da lógica para carregar os dados ---

        // --- Lógica para sincronização incremental em chunks ---
        const chunk = e.parameter.chunk;
        if (chunk) {
            const chunkIndex = parseInt(e.parameter.chunkIndex);
            const totalChunks = parseInt(e.parameter.totalChunks);
            const isIncremental = e.parameter.incremental === 'true';
            const cache = CacheService.getUserCache();
            const cacheKey = `sync_data_${TOKEN_SECRETO}`;

            let cachedData = cache.get(cacheKey);
            let dataChunks = cachedData ? JSON.parse(cachedData) : [];

            dataChunks[chunkIndex] = chunk;
            cache.put(cacheKey, JSON.stringify(dataChunks), 600);

            // Verifica se todos os chunks foram recebidos
            if (dataChunks.length === totalChunks && !dataChunks.includes(null)) {
                const fullJsonString = dataChunks.join('');
                const registros = JSON.parse(fullJsonString);

                const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
                if (!sheet) {
                    return ContentService.createTextOutput(JSON.stringify({
                        status: 'error',
                        message: `Aba "${SHEET_NAME}" não encontrada.`
                    })).setMimeType(ContentService.MimeType.JSON);
                }

                let dadosAdicionados = 0;

                if (isIncremental) {
                    // SINCRONIZAÇÃO INCREMENTAL: Verifica duplicatas antes de adicionar
                    const lastRow = sheet.getLastRow();
                    let registrosExistentes = [];
                    
                    if (lastRow > 1) {
                        const range = sheet.getRange(2, 1, lastRow - 1, 5);
                        const values = range.getValues();
                        registrosExistentes = values.map(row => ({
                            data: row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT-3", "yyyy-MM-dd") : row[0].toString().trim(),
                            hora: row[1] instanceof Date ? Utilities.formatDate(row[1], "GMT-3", "HH:mm") : row[1].toString().trim(),
                            momento: row[2].toString().trim().toUpperCase(),
                            febre: row[3].toString().trim().toUpperCase(),
                            dextro: parseInt(row[4]).toString()
                        }));
                    }

                    // Filtra apenas registros que NÃO existem na planilha
                    const registrosNovos = registros.filter(novoRegistro => {
                        return !registrosExistentes.some(existente => 
                            existente.data === novoRegistro.data.trim() &&
                            existente.hora === novoRegistro.hora.trim() &&
                            existente.momento === novoRegistro.momento.trim().toUpperCase() &&
                            existente.febre === novoRegistro.febre.trim().toUpperCase() &&
                            existente.dextro === parseInt(novoRegistro.dextro).toString()
                        );
                    });

                    const dadosParaAdicionar = registrosNovos.map(registro => [
                        registro.data.trim(),
                        registro.hora.trim(),
                        registro.momento.trim().toUpperCase(),
                        registro.febre.trim().toUpperCase(),
                        parseInt(registro.dextro)
                    ]);

                    if (dadosParaAdicionar.length > 0) {
                        const startRow = sheet.getLastRow() + 1;
                        sheet.getRange(startRow, 1, dadosParaAdicionar.length, dadosParaAdicionar[0].length).setValues(dadosParaAdicionar);
                        dadosAdicionados = dadosParaAdicionar.length;
                        
                        // Ordena os dados por data e hora
                        if (sheet.getLastRow() > 2) {
                            const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5);
                            dataRange.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
                        }
                    }
                } else {
                    // SINCRONIZAÇÃO COMPLETA: Limpa tudo e adiciona
                    const lastRow = sheet.getLastRow();
                    if (lastRow > 1) {
                        sheet.deleteRows(2, lastRow - 1);
                    }

                    const dadosParaAdicionar = registros.map(registro => [
                        registro.data.trim(),
                        registro.hora.trim(),
                        registro.momento.trim().toUpperCase(),
                        registro.febre.trim().toUpperCase(),
                        parseInt(registro.dextro)
                    ]);

                    if (dadosParaAdicionar.length > 0) {
                        // Verifica se já existe um cabeçalho
                        if (sheet.getLastRow() === 0) {
                            sheet.getRange(1, 1, 1, 5).setValues([['Data', 'Hora', 'Momento', 'Febre', 'Dextro']]);
                        }

                        const startRow = sheet.getLastRow() + 1;
                        sheet.getRange(startRow, 1, dadosParaAdicionar.length, dadosParaAdicionar[0].length).setValues(dadosParaAdicionar);
                        dadosAdicionados = dadosParaAdicionar.length;
                        
                        // Ordena os dados por data e hora
                        if (sheet.getLastRow() > 2) {
                            const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5);
                            dataRange.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
                        }
                    }
                }

                cache.remove(cacheKey);

                const tipoSync = isIncremental ? 'incremental' : 'completa';
                const totalEnviados = registros.length;
                
                return ContentService.createTextOutput(JSON.stringify({
                    status: 'success',
                    message: `Sincronização ${tipoSync}: ${dadosAdicionados} novos registros adicionados (${totalEnviados - dadosAdicionados} já existiam).`
                })).setMimeType(ContentService.MimeType.JSON);
            } else {
                return ContentService.createTextOutput(JSON.stringify({
                    status: 'success',
                    message: `Parte ${chunkIndex + 1} de ${totalChunks} recebida. Aguardando outras partes.`
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }
        // --- Fim da lógica de chunks ---

        // --- Lógica para limpar a planilha (mantida para compatibilidade) ---
        if (e.parameter.limparPlanilha === 'true') {
            const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
            if (!sheet) {
                return ContentService.createTextOutput(JSON.stringify({
                    status: 'error',
                    message: 'Aba não encontrada.'
                })).setMimeType(ContentService.MimeType.JSON);
            }

            const lastRow = sheet.getLastRow();
            if (lastRow > 1) {
                sheet.deleteRows(2, lastRow - 1);
            }

            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                message: 'Planilha limpa com sucesso.'
            })).setMimeType(ContentService.MimeType.JSON);
        }
        // --- Fim da lógica para limpar a planilha ---

        // --- Lógica para verificar status da planilha (nova funcionalidade) ---
        if (e.parameter.verificarStatus === 'true') {
            const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
            if (!sheet) {
                return ContentService.createTextOutput(JSON.stringify({
                    status: 'error',
                    message: 'Aba não encontrada.'
                })).setMimeType(ContentService.MimeType.JSON);
            }

            const lastRow = sheet.getLastRow();
            const totalRegistros = lastRow > 1 ? lastRow - 1 : 0;
            
            // Pega os últimos 5 registros para verificação
            let ultimosRegistros = [];
            if (totalRegistros > 0) {
                const startRow = Math.max(2, lastRow - 4);
                const numRows = lastRow - startRow + 1;
                const range = sheet.getRange(startRow, 1, numRows, 5);
                const values = range.getValues();
                
                ultimosRegistros = values.map(row => ({
                    data: row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT-3", "yyyy-MM-dd") : row[0].toString().trim(),
                    hora: row[1] instanceof Date ? Utilities.formatDate(row[1], "GMT-3", "HH:mm") : row[1].toString().trim(),
                    dextro: parseInt(row[4])
                }));
            }

            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                message: 'Status verificado com sucesso.',
                data: {
                    totalRegistros: totalRegistros,
                    ultimosRegistros: ultimosRegistros,
                    ultimaAtualizacao: Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss")
                }
            })).setMimeType(ContentService.MimeType.JSON);
        }
        // --- Fim da verificação de status ---

        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'Requisição GET inválida. Parâmetros suportados: carregarPlanilha, limparPlanilha, verificarStatus, ou dados para sincronização.'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        Logger.log('Erro no doGet: ' + error.toString());
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'Erro interno do servidor: ' + error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}