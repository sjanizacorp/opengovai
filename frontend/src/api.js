import axios from 'axios';

// Vite exposes env vars as import.meta.env.VITE_*
// Falls back to /api/v1 for production (proxied by nginx)
const BASE = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({ baseURL: BASE });

export const getDashboard    = () => api.get('/dashboard').then(r => r.data);
export const getAssets       = (params) => api.get('/assets', { params }).then(r => r.data);
export const createAsset     = (data) => api.post('/assets', data).then(r => r.data);
export const deleteAsset     = (id) => api.delete(`/assets/${id}`).then(r => r.data);
export const getAssetBOM     = (id) => api.get(`/assets/${id}/bom`).then(r => r.data);
export const getScans        = (params) => api.get('/scans', { params }).then(r => r.data);
export const getScan         = (id) => api.get(`/scans/${id}`).then(r => r.data);
export const startScan       = (data) => api.post('/scans', data).then(r => r.data);
export const getFindings     = (params) => api.get('/findings', { params }).then(r => r.data);
export const updateFinding   = (id, data) => api.patch(`/findings/${id}`, data).then(r => r.data);
export const getCompliance   = (fw) => api.get(`/compliance/${fw}`).then(r => r.data);
export const generateEvidence = (fw, assetId) => api.post('/compliance/evidence', null, { params: { framework: fw, asset_id: assetId } }).then(r => r.data);
export const getPolicies     = () => api.get('/policies').then(r => r.data);
export const createPolicy    = (data) => api.post('/policies', data).then(r => r.data);
export const getWorkflows    = (params) => api.get('/workflows', { params }).then(r => r.data);
export const createWorkflow  = (data) => api.post('/workflows', data).then(r => r.data);
export const approveWorkflowStage = (id, approver, notes) =>
  api.patch(`/workflows/${id}/approve`, null, { params: { approver, notes } }).then(r => r.data);
