        //---------------------Colocar no googlesheets---------------------------------------

        // Definir as constantes para o ID da planilha e o nome da aba uma única vez no topo
        const COLE_AQUI_O_ID_DA_SUA_PLANILHA ='1piKVRQ0IkW890K3eYVFh-Z-xW4LyeZoAl231cFtibpo';
        const COLE_AQUI_O_NOME_DA_SUA_ABA='glisemia';
        function doPost(e) {
            // Esta função é acionada quando uma requisição POST é feita ao script (para enviar dados)
            var sheetId = COLE_AQUI_O_ID_DA_SUA_PLANILHA; // <<<<<<< SUBSTITUA POR SEU ID!
            var sheetName = COLE_AQUI_O_NOME_DA_SUA_ABA; // <<<<<<< SUBSTITUA PELO NOME DA SUA ABA (ex: 'Sheet1' ou 'Página1')
            var sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
            if (e.postData.contents) {
                var data = JSON.parse(e.postData.contents);
            // Define a ordem esperada dos cabeçalhos
                var headers = ['data', 'hora', 'momento', 'febre', 'dextro'];
            // Garante que a primeira linha contém os cabeçalhos esperados
            // Se a planilha estiver vazia ou os cabeçalhos não corresponderem, defina-os
                var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
                if (!existingHeaders || existingHeaders.length === 0 || headers.some((h, i) => h !== existingHeaders[i])) {
            sheet.clearContents(); // Limpa se os cabeçalhos não correspondem para evitar dados incorretos
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            }
            // Prepara os dados para serem inseridos na linha
            var rowsToAppend = [];
            // Se for um array de objetos (múltiplos registros), itere sobre eles
            if (Array.isArray(data)) {
                data.forEach(record => {
                    var rowData = [];
                    headers.forEach(header => {
                        rowData.push(record[header] !== undefined ? record[header] : '');
                    });
                    rowsToAppend.push(rowData);
                });
            } else { // Se for um único objeto
                var rowData = [];
                headers.forEach(header => {
                    rowData.push(data[header] !== undefined ? data[header] : '');
                });
                rowsToAppend.push(rowData);
            }
            if (rowsToAppend.length > 0) {
            // Usa appendRow para cada linha no array, pois appendRow adiciona uma única linha por vez
                for (var i = 0; i < rowsToAppend.length; i++) {
                    sheet.appendRow(rowsToAppend[i]);
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ 'status': 'success', 'message': 'Dados adicionados com sucesso!' }))
            .setMimeType(ContentService.MimeType.JSON);
            }
            return ContentService.createTextOutput(JSON.stringify({ 'status': 'error', 'message': 'Nenhum dado recebido.' }))
            .setMimeType(ContentService.MimeType.JSON);
        }

        function doGet(e) {
            // Esta função é acionada quando uma requisição GET é feita ao script (para ler dados)
            var sheetId = COLE_AQUI_O_ID_DA_SUA_PLANILHA; // <<<<<<< SUBSTITUA POR SEU ID!
            var sheetName = COLE_AQUI_O_NOME_DA_SUA_ABA; // <<<<<<< SUBSTITUA PELO NOME DA SUA ABA
            var sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
            var data = sheet.getDataRange().getValues();
            // Transforma o array de arrays em um array de objetos JSON
            var headers = data[0]; // Assume que a primeira linha são os cabeçalhos
            var records = [];
            for (var i = 1; i < data.length; i++) { // Começa do 1 para pular os cabeçalhos
                var row = data[i];
                var record = {};
                for (var j = 0; j < headers.length; j++) {
                    record[headers[j]] = row[j];
                }
                records.push(record);
            }
            return ContentService.createTextOutput(JSON.stringify(records))
            .setMimeType(ContentService.MimeType.JSON);
        }