# Aplicativo Windows e Linux

O código principal está em `/home/miguel/Documentos/GitHub/LSNGrace`.
O desktop usa Electron para incluir o Node e reaproveitar o servidor científico
existente. `src-tauri` é o protótipo anterior; não participa deste empacotamento.

## Instalar e executar

- Linux: instale Grace (`sudo apt install grace` em Debian/Ubuntu). Use o `.deb`
  ou `chmod +x LSNGrace-*.AppImage` seguido da execução do AppImage.
  Alguns sistemas precisam de `libfuse2` ou `libfuse2t64` para AppImage.
- Windows: execute `LSNGrace-Setup-<versão>-x64.exe`. O motor original depende
  de WSL com uma distribuição Ubuntu configurada como padrão. No PowerShell,
  instale com `wsl --install -d Ubuntu`, conclua a configuração e execute
  `wsl --exec sudo apt-get update` e `wsl --exec sudo apt-get install -y grace python3 libcairo2 librsvg2-2`.
  A interface inclui Node; não é necessário instalar Node ou Git para usar o app.
  O Grace/WSL ainda é uma dependência externa, não incluída no instalador.

## Gerar pacotes

Com Node 24 ou superior, rode `npm ci` e depois:

```sh
npm run desktop:dev
npm run desktop:linux
```

No Windows: `npm run desktop:windows`. Os arquivos ficam em `release/`.
Para compilar Windows a partir de Linux, o electron-builder pode precisar de Wine;
o workflow usa um runner Windows para evitar essa dependência de compilação.
Neste ambiente, a tentativa de criar o instalador pelo Wine falhou.
O `.exe` portátil foi gerado como alternativa; a instalação NSIS é gerada no
runner Windows do workflow. A versão portátil requer atualização manual.
O instalador Windows ainda não tem certificado de assinatura Authenticode.

## Atualizações pelo GitHub

Repositório: https://github.com/intcarlosmiguel/LSNGrace

O aplicativo consulta GitHub Releases ao iniciar e a cada quatro horas. Também
exibe **Buscar atualização**. Quando há uma versão mais recente, **Atualizar**
baixa o pacote e mostra o progresso; **Reiniciar e instalar** salva o rascunho
atual antes de fechar e instalar. Falhas de rede aparecem no controle, com opção
de tentar novamente. O app não executa `git pull` no computador do usuário.
No Linux, use AppImage para atualização pelo botão; para `.deb`, prefira instalar
a versão nova pelo gerenciador de pacotes (ele pode solicitar elevação).

Para publicar uma versão, altere `version` em `package.json` e o lockfile,
faça commit, envie a branch e envie uma tag correspondente, por exemplo:

```sh
npm version patch
git push origin HEAD --follow-tags
```

O workflow `.github/workflows/desktop.yml` executa os testes com Grace,
gera Windows NSIS, Linux AppImage e DEB e publica instaladores, blockmaps e
`latest*.yml` no mesmo Release. É necessário permitir Actions no repositório.
O job de publicação usa apenas o `GITHUB_TOKEN` temporário do próprio workflow.
O repositório deve ser público para as instalações consultarem as versões sem
credenciais. Não inclua tokens pessoais no aplicativo.

Executar o workflow manualmente gera artefatos para download em Actions sem
publicar uma versão. Um commit comum na branch não dispara atualização para
usuários: uma tag de versão e um Release publicado são necessários.

O servidor desktop escuta apenas `127.0.0.1:1421`; a porta estável mantém os
rascunhos e o histórico entre execuções. Não execute outro serviço nessa porta.
