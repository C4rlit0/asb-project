# AirSave

AirSave is a browser extension and web application that keeps your Airtable Automations safe. Every change is stored so you can easily revert to any previous version.

## Features
- Save and track all automation changes
- Restore prior versions with one click
- Manage your history from a simple interface

## Installation
1. Clone the repository
   ```bash
   git clone <repository-url>
   cd asb-project
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Copy the example environment configuration and edit it
   ```bash
   cp .env.example .env
   ```

## Starting the Server
Run the development server with:
```bash
npm start
```
Then open `http://localhost:8080` in your browser.

### Docker (optional)
If you prefer Docker, you can start everything with:
```bash
docker-compose up
```

## License
This project is released under the [MIT License](LICENSE).
