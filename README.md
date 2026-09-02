# Conversor Online

Baixador de vídeos do YouTube em MP4 ou MP3, direto pelo navegador. Cola o link, escolhe formato e qualidade, baixa. Sem cadastro, sem anúncio.

## Como funciona

A interface (`app/page.tsx`) manda a URL para `/api/info`, que chama o `yt-dlp` para pegar título, thumbnail e as resoluções disponíveis do vídeo. Ao clicar em baixar, `/api/download` faz o trabalho pesado:

- **MP3**: o `yt-dlp` extrai o áudio e passa direto pro `ffmpeg` via pipe, que reencoda no bitrate escolhido (64 a 320 kbps) e transmite o resultado sem gravar nada em disco.
- **MP4 até 720p**: o `yt-dlp` já entrega um stream progressivo (vídeo + áudio juntos), então a resposta é só um repasse direto.
- **MP4 acima de 720p**: o YouTube só oferece vídeo e áudio separados nessas resoluções. Por isso é preciso baixar os dois streams, mesclar com `ffmpeg --merge-output-format mp4` num arquivo temporário e só então servir o download — mais lento, mas é o único jeito de entregar full HD/4K sem quebrar o áudio.

Toda URL passa por validação de host (só domínios do YouTube) e o ID do vídeo é extraído e checado contra o formato esperado antes de qualquer chamada externa, para evitar injeção de argumentos no `yt-dlp`.

## Rodando localmente

Precisa de `yt-dlp` instalado e no PATH (ou aponte `YTDLP_PATH` para o binário). O `ffmpeg` vem embutido via `ffmpeg-static`, não precisa instalar à parte.

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`.

## Build com Docker

O `Dockerfile` já resolve as dependências de sistema (ffmpeg, python3, e baixa o `yt-dlp` mais recente do GitHub na hora do build):

```bash
docker build -t conversor .
docker run -p 3000:3000 conversor
```

## Stack

Next.js 16 (App Router) + React 19 + Tailwind 4. Sem banco de dados — cada requisição é isolada, nada fica persistido além do arquivo temporário usado no merge de vídeo em alta qualidade, que é apagado assim que a resposta termina de ser enviada.

## Limitações conhecidas

- Depende do YouTube não ter mudado a API que o `yt-dlp` usa por baixo dos panos; quando isso acontece, é questão de atualizar a versão do `yt-dlp`.
- `maxDuration` das rotas está em 60s — vídeos muito longos em qualidade alta podem estourar esse limite dependendo de onde a aplicação está hospedada.
- Não há fila nem limite de taxa; uso pesado concorrente pode sobrecarregar o processo do `ffmpeg`/`yt-dlp` rodando no mesmo host.
