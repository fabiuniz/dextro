// ---------------Codigo 2 do backendo para googleSheets (tokens.gs)

// ------ opcional criar um novo spreadsheet para gerenciar os tokens
const SPREADSHEET_ID_TOKENS = '1FqcdoJIHg6qRlSej2wQn4YUBTFG4YB0RAGEuntK0PbU';
const SHEET_NAME_TOKEN = 'tokens'; 
const KEY_FIND = 'IOT_Glisemia';
const TOKEN_SECRETO =  get_token_by_api(SPREADSHEET_ID_TOKENS, SHEET_NAME_TOKEN, KEY_FIND);
// ------ opcional criar um novo spreadsheet para gerenciar os tokens

const SPREADSHEET_ID = '1nAi7ULJhax-P78vFUjVPsi-ZGzCalx-0iX7kWXtdNhQ'; 
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

        // Carregar planilha
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

            const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

            const registros = values.map(row => {
                const registro = {};
                headers.forEach((header, index) => {
                    registro[header] = row[index];
                });
                return registro;
            });

            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                message: 'Dados carregados com sucesso.',
                data: registros
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Processamento de chunks
        const chunkString = e.parameter.chunk;
        if (chunkString) {
            const chunkIndex = parseInt(e.parameter.chunkIndex);
            const totalChunks = parseInt(e.parameter.totalChunks);
            const isIncremental = e.parameter.incremental === 'true';
            const cache = CacheService.getUserCache();
            const cacheKey = `sync_data_${TOKEN_SECRETO}`;

            // Limpar cache se for o primeiro chunk
            if (chunkIndex === 0) {
                cache.remove(cacheKey);
            }

            // Recuperar chunks do cache
            let chunks = [];
            const cacheData = cache.get(cacheKey);
            if (cacheData) {
                chunks = JSON.parse(cacheData);
            }

            // Garantir que o array tenha o tamanho correto
            while (chunks.length < totalChunks) {
                chunks.push(null);
            }

            // Armazenar chunk atual
            chunks[chunkIndex] = chunkString;
            cache.put(cacheKey, JSON.stringify(chunks), 600);

            // Verificar se todos os chunks foram recebidos
            const chunksRecebidos = chunks.filter(c => c !== null).length;
            
            if (chunksRecebidos === totalChunks) {
                // Todos os chunks recebidos - processar
                const fullJsonString = chunks.join('');
                const registros = JSON.parse(fullJsonString);
                
                const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
                if (!sheet) {
                    cache.remove(cacheKey);
                    return ContentService.createTextOutput(JSON.stringify({
                        status: 'error',
                        message: 'Aba não encontrada.'
                    })).setMimeType(ContentService.MimeType.JSON);
                }
                
                cache.remove(cacheKey);

                // Limpar planilha se não for incremental
                if (!isIncremental) {
                    const lastRow = sheet.getLastRow();
                    if (lastRow > 1) {
                        sheet.deleteRows(2, lastRow - 1);
                    }
                }

                let dadosAdicionados = 0;
                
                if (registros.length > 0) {
                    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
                    const novosRegistros = registros.map(registro => {
                        return headers.map(header => registro[header] || '');
                    });
                    
                    const startRow = sheet.getLastRow() + 1;
                    sheet.getRange(startRow, 1, novosRegistros.length, headers.length).setValues(novosRegistros);
                    dadosAdicionados = novosRegistros.length;
                    
                    // Ordenar por data e hora
                    if (sheet.getLastRow() > 2) {
                        const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length);
                        dataRange.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
                    }
                }
                
                return ContentService.createTextOutput(JSON.stringify({
                    status: 'success',
                    message: `${dadosAdicionados} registros adicionados.`,
                    added: dadosAdicionados
                })).setMimeType(ContentService.MimeType.JSON);
            } else {
                // Aguardando mais chunks
                return ContentService.createTextOutput(JSON.stringify({
                    status: 'success',
                    message: `Chunk ${chunkIndex + 1}/${totalChunks} recebido.`
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // Limpar planilha
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
                message: 'Planilha limpa.'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Verificar status
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
            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                message: 'Status verificado.',
                data: {
                    totalRegistros: totalRegistros,
                    ultimaAtualizacao: Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm:ss")
                }
            })).setMimeType(ContentService.MimeType.JSON);
        }

        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'Parâmetro inválido.'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'Erro: ' + error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}
// --------------- Testes ----------------------------------------------------

https://script.google.com/macros/s/AKfycbwc7R9Wy32QrHkJCdk3mkQyCMmp9ayc_Qnir7cQhR7I/dev?token=seu_token_secreto_e_forte&chunk=%5B%7B%22id%22%3A%221%22%2C%22data%22%3A%222024-12-01%22%2C%22hora%22%3A%2206%3A00%22%2C%22momento%22%3A%22JEJUM%22%2C%22febre%22%3A%22n%C3%A3o%22%2C%22dextro%22%3A%22106%22%7D%2C%7B%22id%22%3A%222%22%2C%22data%22%3A%222024-12-01%22%2C%22hora%22%3A%2208%3A00%22%2C%22momento%22%3A%2202%20Horas%20P%C3%B3s%20Caf%C3%A9%22%2C%22febre%22%3A%22n%C3%A3o%22%2C%22dextro%22%3A%22104%22%7D%5D&chunkIndex=0&totalChunks=1&incremental=true
https://script.google.com/macros/s/AKfycbwc7R9Wy32QrHkJCdk3mkQyCMmp9ayc_Qnir7cQhR7I/dev?token=seu_token_secreto_e_forte&chunk=%7B%22id%22%3A%222%22%2C%22data%22%3A%222024-12-01%22%2C%22hora%22%3A%2208%3A00%22%2C%22momento%22%3A%2202%20Horas%20P%C3%B3s%20Caf%C3%A9%22%2C%22febre%22%3A%22n%C3%A3o%22%2C%22dextro%22%3A%22104%22%7D%5D&chunkIndex=1&totalChunks=2&incremental=true

https://script.google.com/macros/s/AKfycbwc7R9Wy32QrHkJCdk3mkQyCMmp9ayc_Qnir7cQhR7I/dev?token=seu_token_secreto_e_forte&chunk=%5B%7B%22id%22%3A%221%22%2C%22data%22%3A%222024-12-01%22%2C%22hora%22%3A%2206%3A00%22%2C%22febre%22%3A%22n%C3%A3o%22%2C%22dextro%22%3A%22106%22%7D%2C&chunkIndex=0&totalChunks=2&incremental=true
https://script.google.com/macros/s/AKfycbwc7R9Wy32QrHkJCdk3mkQyCMmp9ayc_Qnir7cQhR7I/dev?token=seu_token_secreto_e_forte&chunk=%7B%22id%22%3A%222%22%2C%22data%22%3A%222024-12-01%22%2C%22hora%22%3A%2208%3A00%22%2C%22momento%22%3A%2202%20Horas%20P%C3%B3s%20Caf%C3%A9%22%2C%22febre%22%3A%22n%C3%A3o%22%2C%22dextro%22%3A%22104%22%7D%5D&chunkIndex=1&totalChunks=2&incremental=true