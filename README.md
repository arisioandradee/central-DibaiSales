# 🧩 Central Dibai Sales

Este projeto é uma aplicação **full-stack** dividida em duas partes principais:

- **Backend (Python/FastAPI):** Lida com a lógica de negócios e API.  
- **Frontend (React/TypeScript):** Lida com a interface do usuário.

---

## 🚀 Como Iniciar o Projeto

### 1. Inicialização do Backend (API)

O backend está contido na pasta **`backend/`**.

#### Passos:

1. **Navegue até a pasta do backend:**
   ```bash
   cd backend
   ```

2. **Crie e ative o ambiente virtual (recomendado):**

   ```bash
   # Cria o ambiente virtual
   python3 -m venv venv
   ```

   **Ative o ambiente virtual:**
   ```bash
   # Linux/macOS
   source venv/bin/activate

   # Windows (PowerShell)
   .\venv\Scripts\Activate
   ```

3. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Inicie o servidor:**
   ```bash
   uvicorn app:app --reload
   ```

   O backend estará rodando, por padrão, em:  
   👉 [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

### 2. Inicialização do Frontend (Interface)

O frontend está contido na pasta principal (onde estão `src/`, `components/`, `pages/`, etc.).

#### Passos:

1. **Volte para a raiz do projeto:**
   ```bash
   cd ..
   ```

2. **Instale as dependências do Node.js:**
   ```bash
   npm install
   # OU, se estiver usando Bun
   bun install
   ```

3. **Inicie o servidor de desenvolvimento do frontend:**
   ```bash
   npm run dev
   # OU, se estiver usando Bun
   bun run dev
   ```

   O frontend estará acessível em:  
   👉 [http://localhost:5173](http://localhost:5173) *(ou outra porta informada no terminal)*

---

## 🛠️ Status do Projeto

| Componente | Linguagem/Framework      | Localização | Status            |
|-------------|--------------------------|--------------|-------------------|
| **Backend** | Python, FastAPI, Uvicorn | `backend/`   | Em desenvolvimento |
| **Frontend**| React, TypeScript, Vite  | `src/`       | Em desenvolvimento |
