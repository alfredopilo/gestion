import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

const EmailSettings = () => {
  const [config, setConfig] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    senderEmail: '',
    senderName: '',
    activo: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/email-config');
      setConfig(response.data);
      setHasPassword(response.data.hasPassword);
    } catch (error) {
      if (error.response?.status !== 404) {
        toast.error('Error al cargar configuración');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await api.post('/email-config', config);
      toast.success('Configuración guardada exitosamente');
      fetchConfig();
    } catch (error) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast.error('Ingrese un email de prueba');
      return;
    }
    
    setTesting(true);
    try {
      await api.post('/email-config/test', { testEmail });
      toast.success('Email de prueba enviado exitosamente');
    } catch (error) {
      toast.error('Error al enviar email de prueba');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <span className="ml-4 text-gray-600">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Configuración de Email</h1>

      <div className="bg-white rounded-lg shadow p-6 max-w-3xl">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Servidor SMTP <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.smtpHost}
                  onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="smtp.gmail.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Puerto <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={config.smtpPort}
                  onChange={(e) => setConfig({ ...config, smtpPort: parseInt(e.target.value) })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.smtpSecure}
                  onChange={(e) => setConfig({ ...config, smtpSecure: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Usar conexión segura (SSL/TLS)</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usuario SMTP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={config.smtpUser}
                onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="usuario@gmail.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña SMTP {hasPassword && <span className="text-green-600">(configurada)</span>}
              </label>
              <input
                type="password"
                value={config.smtpPassword}
                onChange={(e) => setConfig({ ...config, smtpPassword: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder={hasPassword ? '••••••••' : 'Contraseña'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email del remitente <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={config.senderEmail}
                  onChange={(e) => setConfig({ ...config, senderEmail: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="noreply@escuela.edu"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del remitente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.senderName}
                  onChange={(e) => setConfig({ ...config, senderName: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Sistema Escolar"
                  required
                />
              </div>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.activo}
                  onChange={(e) => setConfig({ ...config, activo: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Activar envío de emails</span>
              </label>
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="text-lg font-semibold mb-3">Probar configuración</h3>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  placeholder="email@prueba.com"
                />
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {testing ? 'Enviando...' : 'Enviar Prueba'}
                </button>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailSettings;
