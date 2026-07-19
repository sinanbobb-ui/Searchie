# Mini Search Engine V3

This version is designed for direct upload to the root of a GitHub repository.

## What you should see in the repository

- `.github`
- `crawler`
- `data`
- `index.html`
- `app.js`
- `style.css`
- `package.json`
- `README.md`

There should be no outer project folder and no `public` folder.

## Setup

1. Create a new empty GitHub repository.
2. Extract the ZIP file.
3. Open the extracted folder.
4. Upload everything inside that folder into the repository.
5. Open `Settings`.
6. Open `Pages`.
7. Under `Build and deployment`, select `GitHub Actions`.
8. Open the `Actions` tab.
9. Open `Crawl and Deploy Search Index`.
10. Click `Run workflow`.

## Seed websites

Edit:

`data/seeds.json`

The included seeds are:

- https://worldstarhiphop.com/
- https://www.vice.com/

## Results

The website lists 10 indexed pages per page and filters the saved index when you search.
