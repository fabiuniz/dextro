import json
import csv

# --- Funções de Conversão ---

def csv_to_json():
    """
    Converte os dados de um arquivo CSV para o formato JSON e imprime no console.
    """
    # Mapeia os cabeçalhos das colunas para os nomes e horários do JSON
    mapeamento_colunas = {
        'Jejum': 'JEJUM',
        '2h após o café': '02 Horas Pós Café',
        'Antes do almoço': 'Antes do Almoço',
        '2h após almoço': '02 horas Pós almoço',
        'Antes do jantar': 'Antes do jantar',
        '2h após o jantar': '02 horas pos jantar'
    }

    # Define horários para cada momento
    momento_para_hora = {
        'JEJUM': '06:00',
        '02 Horas Pós Café': '08:00',
        'Antes do Almoço': '10:00',
        '02 horas Pós almoço': '14:00',
        'Antes do jantar': '19:00',
        '02 horas pos jantar': '22:00'
    }

    dados_json = []

    # O nome do arquivo CSV a ser lido
    nome_arquivo = 'dados.csv'

    try:
        with open(nome_arquivo, 'r', encoding='latin-1') as arquivo_csv:
            leitor = csv.reader(arquivo_csv, delimiter=';')
            cabecalho = next(leitor)
            
            for linha in leitor:
                if len(linha) < 2:
                    continue
                
                data_str = linha[0].strip()
                if not data_str:
                    continue
                
                dia, mes, ano = data_str.split('/')
                data_formatada = f"{ano}-{mes}-{dia}"

                for i in range(1, len(linha)):
                    dextro_valor = linha[i].strip()
                    if dextro_valor:
                        momento_original = cabecalho[i]
                        momento_json = mapeamento_colunas.get(momento_original, momento_original)
                        hora_json = momento_para_hora.get(momento_json, '00:00')

                        registro = {
                            'data': data_formatada,
                            'hora': hora_json,
                            'momento': momento_json,
                            'febre': 'não',
                            'dextro': dextro_valor
                        }
                        dados_json.append(registro)

        if dados_json:
            json_final = json.dumps(dados_json, indent=4, ensure_ascii=False)
            print(json_final)
        else:
            print("Nenhum dado válido foi encontrado no arquivo CSV.")
            
    except FileNotFoundError:
        print(f"Erro: O arquivo '{nome_arquivo}' não foi encontrado.")
    except Exception as e:
        print(f"Ocorreu um erro: {e}")

# ---
def json_to_csv():
    """
    Converte os dados de um arquivo JSON para o formato CSV e imprime no console.
    """
    nome_arquivo_json = 'dados_glicemia.json'
    
    try:
        with open(nome_arquivo_json, 'r', encoding='utf-8') as arquivo_json:
            dados = json.load(arquivo_json)

        if not dados:
            print("Nenhum dado válido foi encontrado no arquivo JSON.")
            return

        # Define os cabeçalhos das colunas do CSV
        cabecalho = list(dados[0].keys())

        # Imprime o cabeçalho no console
        print(';'.join(cabecalho))

        # Imprime cada linha de dados no console
        for linha in dados:
            valores = [str(linha.get(chave, '')) for chave in cabecalho]
            print(';'.join(valores))
            
    except FileNotFoundError:
        print(f"Erro: O arquivo '{nome_arquivo_json}' não foi encontrado.")
    except Exception as e:
        print(f"Ocorreu um erro: {e}")

# --- Menu Principal ---
while True:
    print("\n--- Menu de Conversão ---")
    print("1. Converter CSV para JSON")
    print("2. Converter JSON para CSV")
    print("3. Sair")

    escolha = input("Digite sua escolha (1, 2 ou 3): ")

    if escolha == '1':
        csv_to_json()
    elif escolha == '2':
        json_to_csv()
    elif escolha == '3':
        print("Saindo do programa. Tchau!")
        break
    else:
        print("Escolha inválida. Por favor, tente novamente.")