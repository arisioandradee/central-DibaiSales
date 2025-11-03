const BASE_URL = import.meta.env.VITE_API_URL;  // pega do .env

export const ENDPOINTS = {
  converterPlanilha: `${BASE_URL}/converter_planilha`,
  //extratorEmail: `${BASE_URL}/extrator-email`,
  extratorNumero: `${BASE_URL}/extrator-numero`,
  speedioAssertiva: `${BASE_URL}/speedio_assertiva`,
  transcreverAudios: `${BASE_URL}/transcrever_audios`,
  whatsappValidator: `${BASE_URL}/whatsapp_validator`,
  salesforce: `${BASE_URL}/salesforce`
};