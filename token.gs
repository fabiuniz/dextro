// ---------------Codigo 1 do backendo para googleSheets (opcional)(tokens.gs)

function Test_GetToken() {
  const spreadsheetId = 'seu_id_da_planilha_aqui'; // Substitua pelo ID da sua planilha
  const sheetName = 'IOT_Glisemia';               // Nome da sua aba
  const apiName = 'API_Glisemia';                 // Nome da API a ser buscada
  const token = get_token_by_api(spreadsheetId, sheetName, apiName);
  if (token) {
    Logger.log(`O token para a API '${apiName}' é: ${token}`);
  } else {
    Logger.log(`Não foi possível encontrar o token.`);
  }
  return token;
}
function get_token_by_api(spreadsheet_id, sheet_name, api) {
  // Abre a planilha pelo ID fornecido.
  const spreadsheet = SpreadsheetApp.openById(spreadsheet_id);

  // Tenta obter a aba pelo nome. Se não existir, retorna null.
  const sheet = spreadsheet.getSheetByName(sheet_name);
  if (!sheet) {
    Logger.log(`A aba com o nome "${sheet_name}" não foi encontrada.`);
    return null;
  }

  // Obtém todos os dados da aba.
  const data = sheet.getDataRange().getValues();

  // A primeira linha geralmente contém os cabeçalhos.
  // Procuramos o índice das colunas 'API' e 'TOKEN'.
  const headers = data[0];
  const apiColumnIndex = headers.indexOf('API');
  const tokenColumnIndex = headers.indexOf('TOKEN');

  // Se uma das colunas não for encontrada, retorna null.
  if (apiColumnIndex === -1 || tokenColumnIndex === -1) {
    Logger.log('Colunas "API" ou "TOKEN" não encontradas na aba.');
    return null;
  }

  // Percorre as linhas a partir da segunda (índice 1) para encontrar a API.
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Se o valor na coluna 'API' da linha atual for igual ao API de busca...
    if (row[apiColumnIndex] === api) {
      // Retorna o valor da coluna 'TOKEN' correspondente.
      return row[tokenColumnIndex];
    }
  }

  // Se o loop terminar e a API não for encontrada, retorna null.
  Logger.log(`A API "${api}" não foi encontrada na aba "${sheet_name}".`);
  return null;
}