# Records release form (2026-11-06)

`public/assets/nysvms-release-form.pdf` is built from `release.html` (the design) by `build-release.mjs`, which prints it to a
letter-size PDF in headless Chrome and adds a typeable PDF field over every box marked `data-field`.

Redesigned by Tim's request from the Word document at bit.ly/nysvmsrelease (Dropbox). The permission sentence keeps the
original wording, with "complaints service" renamed "mediation service".

To change it: edit `release.html`, copy `public/assets/nysvms-logo-on-dark.png` next to it as `logo.png`, then in a folder with
`pdf-lib@1.17.1` installed run `node build-release.mjs <folder with release.html> <out.pdf>` and copy the PDF to `public/assets/`.
