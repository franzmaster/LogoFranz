
import { LogoProject } from "../types";

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
  async saveData(action: 'register' | 'login' | 'saveProject' | 'updateProfile', payload: any) {
    if (SCRIPT_URL.includes("SUA_URL_AQUI")) {
      console.warn("Google Sheets SCRIPT_URL não configurado. Simulando resposta...");
      return { success: true, data: payload };
    }

    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...payload }),
      });
      
      return { success: true };
    } catch (error) {
      console.error("Erro na comunicação com Sheets:", error);
      throw error;
    }
  },

  getUsers(): any[] {
    const data = localStorage.getItem('franz_users');
    return data ? JSON.parse(data) : [];
  },

  saveUserLocal(user: any) {
    const users = this.getUsers();
    users.push(user);
    localStorage.setItem('franz_users', JSON.stringify(users));
  },

  updateUserLocal(updatedUser: any) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updatedUser };
      localStorage.setItem('franz_users', JSON.stringify(users));
    }
    localStorage.setItem('franz_session', JSON.stringify(updatedUser));
  },

  saveProjectLocal(project: LogoProject) {
    const data = localStorage.getItem('franz_projects');
    const projects: LogoProject[] = data ? JSON.parse(data) : [];
    const index = projects.findIndex(p => p.id === project.id);
    
    if (index !== -1) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    
    localStorage.setItem('franz_projects', JSON.stringify(projects));
  },

  getProjectsLocal(userId: string): LogoProject[] {
    const data = localStorage.getItem('franz_projects');
    if (!data) return [];
    const projects: LogoProject[] = JSON.parse(data);
    return projects.filter(p => p.userId === userId);
  }
};
