
/**
 * Para utilizar este serviço, você deve:
 * 1. Criar uma Planilha no Google Sheets.
 * 2. Ir em Extensões > Apps Script.
 * 3. Colar um código que trate requisições POST e salve/leia as linhas.
 * 4. Publicar como "App da Web" e permitir acesso de "Qualquer pessoa".
 */

// Substitua pela URL gerada ao publicar o Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/SUA_URL_AQUI/exec";

export const sheetService = {
  async saveData(action: 'register' | 'login' | 'saveProject', payload: any) {
    // Por ser um exemplo didático e o Apps Script ter restrições de CORS em alguns contextos,
    // simularemos a resposta de sucesso enquanto a URL não for fornecida.
    if (SCRIPT_URL.includes("SUA_URL_AQUI")) {
      console.warn("Google Sheets SCRIPT_URL não configurado. Simulando resposta...");
      return { success: true, data: payload };
    }

    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", // Necessário para evitar bloqueios de CORS simples do Google Apps Script
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...payload }),
      });
      
      // Com no-cors, não conseguimos ler o corpo da resposta.
      // Em uma implementação real, recomenda-se usar um servidor proxy ou configurar o Apps Script adequadamente.
      return { success: true };
    } catch (error) {
      console.error("Erro na comunicação com Sheets:", error);
      throw error;
    }
  },

  // Armazenamento Local de Fallback (para que o app funcione imediatamente)
  getUsers(): any[] {
    const data = localStorage.getItem('franz_users');
    return data ? JSON.parse(data) : [];
  },

  saveUserLocal(user: any) {
    const users = this.getUsers();
    users.push(user);
    localStorage.setItem('franz_users', JSON.stringify(users));
  }
};
