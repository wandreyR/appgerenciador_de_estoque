# Gestor de Estoque Confecção

Sistema local (localhost) para controle de estoque em grade (cor × tamanho), pedidos e romaneio de separação com fotos, distribuído como um único **`GestorEstoque.exe`** para Windows. O cliente não precisa instalar Python, Node nem banco de dados.

## Estrutura

```
appgerenciadordeestoque/
├── backend/                  FastAPI + SQLAlchemy + SQLite
│   ├── run.py                ponto de entrada do .exe (servidor + navegador)
│   ├── estoque.spec          configuração do PyInstaller
│   ├── requirements.txt
│   └── app/
│       ├── main.py           app, trava de licença, arquivos estáticos
│       ├── config.py         caminhos (%APPDATA%\EstoqueConfeccao)
│       ├── database.py / models.py / schemas.py / serializers.py
│       ├── images.py         otimização de fotos (1400px + miniatura 400px)
│       ├── backup.py         backup .zip / restauração / backup automático diário
│       ├── services.py       movimentação de estoque com histórico
│       ├── license/          hwid.py, manager.py, public_key.py
│       └── routers/          categories, products, stock, customers, orders, dashboard, system, license
├── frontend/                 React + TypeScript + Tailwind v4 (Vite)
│   └── src/pages/            Activation, Dashboard, Products, ProductForm, NewOrder,
│                             Orders, OrderDetail, OrderPrint, Stock, Customers, Categories, Settings
├── keygen_admin/             USO INTERNO — LicencasAdmin (não distribuir)
│   ├── run_admin.py          ponto de entrada do LicencasAdmin.exe
│   ├── admin.spec
│   └── admin_app/            crypto.py (assinatura), db.py (registro), publisher.py (GitHub Gist), main.py (API)
├── frontend/admin/           tela do LicencasAdmin (reaproveita os componentes do sistema)
├── scripts/                  build.ps1, build_admin.ps1, dev.ps1, make_icon.py
└── dist/
    ├── GestorEstoque.exe     vai para os clientes
    └── LicencasAdmin.exe     fica SÓ no seu computador
```

## Onde ficam os dados do cliente

`%APPDATA%\EstoqueConfeccao\` contém `estoque.db`, `media\` (fotos), `license.dat`, `backups\` (backup automático diário, mantém os 10 últimos) e `logs\app.log`.
Como os dados ficam fora do `.exe`, atualizar o sistema é só substituir o executável.

## Compilar

Pré-requisitos (só na sua máquina): Python 3.11+ e Node 20+.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_admin.ps1   # dist\LicencasAdmin.exe (seu)
powershell -ExecutionPolicy Bypass -File scripts\build.ps1         # dist\GestorEstoque.exe (clientes)
```

O `build.ps1` avisa se a URL da verificação diária ainda não foi configurada. Opções do GestorEstoque.exe: `--webview` (janela nativa, requer `pywebview` no build) e `--no-browser`.

**Antivírus:** executáveis PyInstaller não assinados às vezes geram falso positivo. Para distribuição comercial, assine os .exe com um certificado de assinatura de código.

## Licenciamento

### LicencasAdmin.exe (só no seu computador)
Dados em `%APPDATA%\EstoqueLicencasAdmin\`: `private_key.pem`, `licencas.db` (registro de todas as licenças) e `config.json` (token do GitHub criptografado com DPAPI).
Na primeira execução ele importa automaticamente a chave existente em `keygen_admin\keys\`.

- **Licenças:** criar (HWID + cliente + validade em dias, até uma data ou vitalícia), buscar, copiar a chave, **excluir** e restaurar, verificar uma chave colada.
- **Publicação online:** token do GitHub → "Publicar agora" cria um Gist secreto com a lista assinada. Também dá para baixar `licencas.json` e hospedar em outro lugar.
- **Chaves e cliente:** backup e importação da chave privada, e o botão **Gravar no projeto**, que grava a chave pública e a URL em `backend/app/license/public_key.py`.

### Configuração inicial (uma vez)
1. Crie um token no GitHub (Settings → Developer settings → Personal access tokens) com permissão **gist**.
2. No LicencasAdmin, em **Publicação online**, cole o token, salve e clique em **Publicar agora**.
3. Em **Chaves e cliente**, clique em **Gravar no projeto** e depois rode `scripts\build.ps1`.
4. Distribua o novo `GestorEstoque.exe`.

### Fluxo de venda
1. O cliente abre o sistema e envia o **HWID** mostrado na tela de ativação.
2. No LicencasAdmin, **Nova licença** → copie a chave `EST1-...` e envie ao cliente.
3. O cliente cola a chave e clica em **Ativar** (com internet, a ativação já confere se a licença não foi excluída).

### Exclusão e verificação diária
- Excluir uma licença no admin publica automaticamente a nova lista assinada.
- O sistema do cliente baixa a lista **a cada 24h** (verifica ao abrir e de hora em hora se o prazo venceu). Se a licença estiver na lista, ele bloqueia com "Licença cancelada pelo fornecedor".
- **Sem internet:** continua funcionando por **7 dias** desde a última verificação bem-sucedida. A partir do 2º dia aparece um aviso; depois dos 7 dias bloqueia, e o botão **Verificar agora** libera assim que houver conexão.
- **Restaurar** uma licença a libera de novo na próxima verificação.
- A lista contém só IDs, sem nomes. Ela é assinada (não pode ser falsificada) e numerada: uma lista mais antiga reenviada para "desfazer" uma exclusão é rejeitada.

### Segurança
- **Ed25519 (assimétrico):** o .exe do cliente contém só a chave pública.
- **HWID** = SHA-256 de UUID SMBIOS + serial da placa-mãe + serial do disco do sistema. Trocar a placa-mãe ou o disco exige uma nova licença.
- `license.dat` é criptografado com uma chave derivada do HWID, então copiar o arquivo para outra máquina não funciona.
- **Relógio:** o último uso fica gravado em 3 lugares (arquivo, Registro e banco). Voltar a data do Windows bloqueia o sistema.
- **Se você perder a chave privada, não consegue mais emitir nem excluir licenças** dos sistemas instalados. Use **Baixar backup da chave privada** e guarde o arquivo em local seguro.

## Desenvolvimento

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
# Backend: http://127.0.0.1:8000 (docs em /api/docs)  ·  Frontend: http://localhost:5173
```
Admin em desenvolvimento: `backend\.venv\Scripts\python keygen_admin
un_admin.py` (API na porta 8765) + `npm run dev:admin` em `frontend/` (http://localhost:5174).
Para usar outra pasta de dados durante testes, defina a variável `ESTOQUE_DATA_DIR`.

## Funcionalidades

- **Produtos:** tipo/categoria (dá para criar novos na própria tela), modelo, SKU base, custo/venda com cálculo de margem, foto geral, e a **matriz de grade** cores × tamanhos com quantidade e estoque mínimo por célula. Tem grades prontas (Letras, Plus, Numeração, Infantil, Único), tamanhos livres, seletor de cor hex com nomes sugeridos e **foto por cor**. Os SKUs das variações são gerados automaticamente (`BL-001-AZM-M`).
- **Pedidos:** busca por nome/SKU/cor e filtros de categoria/cor/tamanho, com miniatura e saldo em tempo real por tamanho. Ao confirmar, **baixa o estoque** e registra no histórico. O status vai de pendente → separado → entregue; o cancelamento **devolve o estoque**.
- **Romaneio A4:** fundo branco, foto grande na cor exata, badge da cor, tamanho em destaque, quantidade, checkboxes "Sep." e "Conf.", assinaturas e observações. Os itens vêm ordenados por modelo, cor e tamanho, e `break-inside: avoid` impede que uma linha seja cortada entre páginas. "Salvar como PDF" na janela de impressão gera o arquivo.
- **Estoque:** entrada (reposição), saída (avaria/perda), ajuste de inventário (saldo contado) e histórico completo de movimentações.
- **Painel:** peças, valor em estoque (custo e venda), pedidos a separar, alertas de estoque mínimo e vendas do mês.
- **Backup:** um clique baixa um `.zip` com o banco e as fotos. A restauração valida o arquivo e, antes de substituir, salva automaticamente o estado atual.
