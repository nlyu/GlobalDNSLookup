# Global DNS Lookup

A static developer utility that compares A, AAAA and CNAME records using representative EDNS Client Subnets across 30 regions.

## Features

- Browser-side DNS-over-HTTPS queries
- Google Public DNS with AliDNS fallback
- AliDNS-first resolution for China Mainland
- Progressive per-region results
- No accounts, database or application backend
- Responsive, accessible interface

## Local development

Serve the repository with any static file server:

```powershell
python -m http.server 4173
```

Open `http://127.0.0.1:4173/`.

## Checks

```powershell
npm test
npm run build
```

The build command copies deployable files to `dist/`. The directory is generated and intentionally excluded from Git.

## Deployment

Pushes to `main` automatically test, build and deploy `dist/` through GitHub Pages.

## License

MIT