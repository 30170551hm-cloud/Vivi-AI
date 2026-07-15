// WorkspaceIntegrationsTool — Google Drive, Gmail, and Google Calendar tool.
// Designed with modular, asynchronous handlers, timeouts, and error handling.

import { ToolBase } from './ToolBase';

export default class WorkspaceIntegrationsTool extends ToolBase {
  constructor() {
    super({
      name: 'google_workspace',
      description: 'Interactúa con Google Workspace: buscar/subir en Drive, leer/enviar correos en Gmail, y ver/crear eventos en Google Calendar.',
      category: 'productivity',
      permissions: ['google:workspace:read', 'google:workspace:write'],
      timeout: 20000, // Rich API calls can take longer
      retries: 1,
    });
  }

  async execute(params, context) {
    const service = params?.service; // 'gmail' | 'calendar' | 'drive'
    const action = params?.action;    // Specific service action

    // Validate token existence in context or settings
    const token = params?.oauth_token || context?.oauth_token || null;
    
    if (!token) {
      return {
        success: false,
        data: null,
        error: `Falta el token de autorización de Google OAuth. 
Para usar las integraciones de Google Workspace:
1. Activa las scopes requeridas en la consola de Google Developer:
   - Gmail: https://www.googleapis.com/auth/gmail.modify o gmail.send
   - Calendar: https://www.googleapis.com/auth/calendar
   - Drive: https://www.googleapis.com/auth/drive.metadata.readonly o drive.file
2. Solicita credenciales de OAuth al usuario e inicializa el flujo.`,
      };
    }

    try {
      switch (service) {
        case 'gmail':
          return await this.handleGmail(action, params, token);
        case 'calendar':
          return await this.handleCalendar(action, params, token);
        case 'drive':
          return await this.handleDrive(action, params, token);
        default:
          return {
            success: false,
            data: null,
            error: `Servicio de Google Workspace no soportado: '${service}'`,
          };
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        error: `Error de API en Google Workspace (${service}:${action}): ${err.message || err}`,
      };
    }
  }

  // ── Gmail Handler ──
  async handleGmail(action, params, token) {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (action === 'send') {
      const { to, subject, body } = params;
      if (!to || !body) {
        return { success: false, error: 'Se requiere "to" (destinatario) y "body" (mensaje).' };
      }

      // Base64Url encode raw MIME email
      const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject || '')))}?=`;
      const emailContent = [
        `To: ${to}`,
        `Subject: ${utf8Subject}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        body,
      ].join('\r\n');

      const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({ raw: encodedEmail }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Error HTTP ${res.status}`);
      }

      const data = await res.json();
      return { success: true, data: { messageId: data.id, threadId: data.threadId, status: 'sent' } };
    }

    if (action === 'list') {
      const query = params.query || '';
      const limit = params.limit || 5;
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`;
      
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Error HTTP ${res.status}`);
      }

      const listData = await res.json();
      const messages = [];

      // Fetch message details in parallel (fully async!)
      if (listData.messages && listData.messages.length > 0) {
        const fetchDetails = listData.messages.map(async (msg) => {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, { headers });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const headersList = detail.payload?.headers || [];
            const subjectHeader = headersList.find(h => h.name.toLowerCase() === 'subject');
            const fromHeader = headersList.find(h => h.name.toLowerCase() === 'from');
            const dateHeader = headersList.find(h => h.name.toLowerCase() === 'date');

            messages.push({
              id: detail.id,
              threadId: detail.threadId,
              snippet: detail.snippet,
              subject: subjectHeader?.value || '(Sin asunto)',
              from: fromHeader?.value || '(Desconocido)',
              date: dateHeader?.value || '',
            });
          }
        });
        await Promise.all(fetchDetails);
      }

      return { success: true, data: { messages } };
    }

    return { success: false, error: `Acción '${action}' no implementada para Gmail.` };
  }

  // ── Google Calendar Handler ──
  async handleCalendar(action, params, token) {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (action === 'list') {
      const maxResults = params.limit || 10;
      const timeMin = params.timeMin || new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=${maxResults}&timeMin=${timeMin}&singleEvents=true&orderBy=startTime`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Error HTTP ${res.status}`);
      }

      const data = await res.json();
      const events = (data.items || []).map((evt) => ({
        id: evt.id,
        summary: evt.summary || '(Sin título)',
        description: evt.description || '',
        start: evt.start?.dateTime || evt.start?.date || '',
        end: evt.end?.dateTime || evt.end?.date || '',
        location: evt.location || '',
        link: evt.htmlLink || '',
      }));

      return { success: true, data: { events } };
    }

    if (action === 'create') {
      const { summary, description, start, end, location } = params;
      if (!summary || !start || !end) {
        return { success: false, error: 'Se requiere "summary", "start", y "end".' };
      }

      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          summary,
          description,
          start: { dateTime: new Date(start).toISOString() },
          end: { dateTime: new Date(end).toISOString() },
          location,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Error HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        success: true,
        data: {
          id: data.id,
          link: data.htmlLink,
          status: 'created',
        },
      };
    }

    return { success: false, error: `Acción '${action}' no implementada para Google Calendar.` };
  }

  // ── Google Drive Handler ──
  async handleDrive(action, params, token) {
    const headers = {
      'Authorization': `Bearer ${token}`,
    };

    if (action === 'list' || action === 'search') {
      const query = params.query || '';
      const limit = params.limit || 10;
      // Search matching name or folder query
      const q = query ? `name contains '${query.replace(/'/g, "\\'")}'` : "trashed = false";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=${limit}&fields=files(id,name,mimeType,webViewLink,iconLink)`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Error HTTP ${res.status}`);
      }

      const data = await res.json();
      return { success: true, data: { files: data.files || [] } };
    }

    return { success: false, error: `Acción '${action}' no implementada para Google Drive.` };
  }
}
