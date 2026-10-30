COMO FUNCIONARÁ O NOVO SISTEMA DE PESQUISA PNCP
Explicação simples sobre o banco de dados e as atualizações
1. O banco será alimentado automaticamente
O cliente não precisará cadastrar nem salvar licitações manualmente. Quando o sistema consultar o PNCP, as contratações e seus itens recebidos serão gravados automaticamente no banco de dados.
2. Exemplo prático de funcionamento
1.	Primeira pesquisa: O usuário pesquisa licitações de notebooks no Ceará. O sistema consulta o PNCP, recebe as informações e armazena os dados no banco.
2.	Pesquisas seguintes: O sistema consulta primeiro o banco local. Se os dados necessários já estiverem armazenados e dentro do prazo de atualização, poderá apresentar os resultados sem baixar tudo novamente.
3.	Atualização: Quando identificar informações novas ou desatualizadas, o sistema consulta o PNCP e atualiza os registros no banco.
4.	Uso contínuo: Com o tempo, o banco reúne mais informações já coletadas, reduzindo downloads repetidos e acelerando as próximas pesquisas.
3. O cliente precisa manter o banco?
Sim. O banco precisa continuar disponível no computador ou servidor onde o sistema funciona. A alimentação e a atualização serão feitas automaticamente pelo próprio sistema, sem trabalho manual do cliente.
Se o banco for apagado ou perdido, as informações armazenadas deixarão de estar disponíveis e precisarão ser coletadas novamente no PNCP. Por isso, é importante manter cópias de segurança (backup).
4. Onde o banco poderá ficar?
Em um único computador: SQLite pode atender a uma instalação simples, utilizada em uma única máquina.
Em um servidor: PostgreSQL pode ser mais adequado quando vários usuários acessam o sistema ou quando ele fica hospedado em servidor.
5. A pesquisa continuará atualizada?
O sistema continuará utilizando o PNCP como fonte oficial, mas as pesquisas consultarão primeiro os dados armazenados. Uma rotina de sincronização buscará novas publicações e atualizações em intervalos configurados. Isso torna a pesquisa mais rápida, mas uma publicação feita há poucos instantes poderá aparecer somente após a próxima sincronização. A atualização também depende da disponibilidade da API do PNCP.
6. Resumo do funcionamento
•	O sistema consulta o banco de dados local.
•	Se os dados estiverem disponíveis e atualizados, apresenta os resultados.
•	Se faltarem dados ou houver informações desatualizadas, consulta o PNCP.
•	Os dados recebidos são armazenados ou atualizados automaticamente.
•	Nas próximas pesquisas, o sistema reaproveita as informações já coletadas.
7. O que será acrescentado ao projeto
•	Estrutura de banco de dados para contratações, itens e controle das sincronizações.
•	Rotinas automáticas para salvar e atualizar os dados coletados.
•	Mecanismo de sincronização incremental com a API do PNCP.
•	Ajustes no módulo de pesquisa para consultar primeiro o banco local.
•	Testes para verificar a atualização e a recuperação das informações.
8. Investimento
Valor do serviço: R$ 450,00
O valor contempla as melhorias descritas neste documento e os testes relacionados a esse escopo. Novas funcionalidades, alterações não previstas e manutenção contínua poderão ser combinadas separadamente.
Proposta explicativa – Otimização do sistema PNCP



O plano Oracle Cloud Free Tier (Always Free) é a melhor alternativa para ter um banco de dados PostgreSQL sem custos e com bastante espaço (até 200 GB de disco total).
Seguem os passos detalhados para criar a conta, configurar a máquina virtual gratuita, instalar o PostgreSQL com Docker e fechá-lo com segurança através da VPN Tailscale.
📋 Pré-requisitos
•	Um cartão de crédito/débito físico (Visa ou Mastercard) para validação da conta. A Oracle faz uma pequena cobrança temporária (~R$ 5 a R$ 10) e estorna em seguida. Não aceita cartões virtuais nem pré-pagos.
•	Uma conta de e-mail válida.
Passo 1: Criar a conta na Oracle Cloud
1.	Acesse o site oficial: oracle.com/cloud/free.
2.	Clique em Start for free (Comece gratuitamente).
3.	Preencha seus dados reais (nome, e-mail e endereço).
4.	Importante - Escolha da Região (Home Region):
o	Escolha uma região próxima (ex: Brazil East - Vinhedo/São Paulo) para ter menor latência.
o	Atenção: A Home Region é definitiva e não pode ser alterada depois.
5.	Insira o cartão de crédito para a validação da identidade.
6.	Finalize o cadastro e aguarde a aprovação (pode levar de alguns minutos até poucas horas).
Passo 2: Criar a Instância Gratuita (VM)
1.	Faça login no painel da Oracle Cloud Infrastructure (OCI).
2.	Na página principal, clique em Create a VM instance (Criar uma instância de VM).
3.	Configuração da Máquina:
o	Name: postgres-server
o	Image: Escolha Ubuntu 22.04 LTS ou Ubuntu 24.04 LTS.
o	Shape (Especificações):
	Clique em Change Shape.
	Selecione a opção Ampere (ARM) -> VM.Standard.A1.Flex.
	Defina: 2 OCPUs e 12 GB de RAM (Você ganha até 4 OCPUs e 24 GB de graça total, podendo usar em 1 ou mais máquinas).
	Certifique-se de que o selo "Always Free" está visível.
4.	SSH Keys (Chave de Acesso):
o	Selecione Generate a key pair for me e clique em Save Private Key (Baixe o arquivo .key). Você usará essa chave para se conectar via terminal à sua máquina.
5.	Boot Volume: Defina o tamanho do disco (ex: 50 GB a 100 GB — o limite gratuito é até 200 GB distribuídos na conta).
6.	Clique no botão Create no final da página e aguarde o status da VM mudar para Running (Verde).
7.	Anote o Public IP Address (IP público) que foi atribuído à sua máquina.
Passo 3: Conectar na Máquina via Terminal/SSH
No seu computador (prompt de comando, PowerShell ou terminal):
Bash
# Ajuste as permissões da chave privada (Linux/Mac)
chmod 400 sua-chave-privada.key

# Conecte-se à VPS
ssh -i sua-chave-privada.key ubuntu@IP_PUBLICO_DA_ORACLE
Passo 4: Instalar Docker e Tailscale (A VPN)
Após entrar no terminal da VPS, execute os comandos abaixo para atualizar o sistema e instalar o Docker e a rede privada Tailscale:
1. Atualizar o sistema e instalar Docker:
Bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
2. Instalar a VPN Tailscale (Gratuita para até 100 dispositivos):
Bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
•	O terminal exibirá um link de autenticação. Abra esse link no seu navegador, crie uma conta gratuita na Tailscale e autorize a VPS.
•	Instale o Tailscale também no seu computador pessoal (e/ou na máquina onde roda sua aplicação/backend).
•	A partir de agora, suas máquinas terão um IP privado (ex: 100.x.y.z) e conseguirão se conversar de forma 100% segura e criptografada.
Passo 5: Subir o PostgreSQL via Docker
Crie uma pasta e o arquivo docker-compose.yml:
Bash
mkdir ~/postgres-data && cd ~/postgres-data
nano docker-compose.yml
Cole a configuração abaixo:
YAML
services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres_db
    restart: always  # Inicia automaticamente junto com a máquina
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: SuaSenhaSuperSeguraAqui
      POSTGRES_DB: meubancodedados
    ports:
      - "5432:5432"
    volumes:
      - postgres_storage:/var/lib/postgresql/data

volumes:
  postgres_storage:
Salve e feche o arquivo (Ctrl + O, Enter, depois Ctrl + X).
Inicie o PostgreSQL:
Bash
docker compose up -d
Passo 6: Segurança Total (Isolar a porta do PostgreSQL)
Para garantir que o seu PostgreSQL fique acessível APENAS via VPN Tailscale e invisível para o resto da internet:
Como a Oracle usa o firewall iptables/ufw por padrão, acesse seu banco usando o IP do Tailscale da VPS:
1.	Para descobrir o IP privado da sua VPS no Tailscale, rode no terminal dela:
Bash
tailscale ip -4
2.	Na sua aplicação ou no DBeaver/pgAdmin (no seu computador local conectado à mesma conta do Tailscale), use a string de conexão:
Plaintext
postgresql://postgres:SuaSenhaSuperSeguraAqui@IP_DO_TAILSCALE:5432/meubancodedados
Com essa arquitetura, você terá uma infraestrutura 100% gratuita, com mais de 50 GB de espaço, totalmente automatizada para reiniciar sozinha e protegida contra invasões.

