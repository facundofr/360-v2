import React, { useState, useEffect } from 'react';
import { 
    Shield, 
    AlertTriangle, 
    Globe, 
    Ban, 
    CheckCircle, 
    RefreshCw,
    Activity,
    Eye,
    Trash2,
    Plus
} from 'lucide-react';

const SecurityDashboard = () => {
    const [securityStats, setSecurityStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [blockIpForm, setBlockIpForm] = useState({ ip: '', reason: '' });
    const [whitelistForm, setWhitelistForm] = useState({ ip: '', reason: '' });

    useEffect(() => {
        loadSecurityData();
        const interval = setInterval(loadSecurityData, 30000); // Actualizar cada 30 segundos
        return () => clearInterval(interval);
    }, []);

    const loadSecurityData = async () => {
        try {
            const token = localStorage.getItem('cober_token');
            const headers = { 'Authorization': `Bearer ${token}` };

            // Cargar estadísticas
            const statsResponse = await fetch('/api/security/stats', { headers });
            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                setSecurityStats(statsData.data);
            }

            // Cargar logs recientes
            const logsResponse = await fetch('/api/security/logs?limit=20', { headers });
            if (logsResponse.ok) {
                const logsData = await logsResponse.json();
                setLogs(logsData.data);
            }

            // Cargar alertas
            const alertsResponse = await fetch('/api/security/alerts', { headers });
            if (alertsResponse.ok) {
                const alertsData = await alertsResponse.json();
                setAlerts(alertsData.data);
            }

            setLoading(false);
        } catch (error) {
            console.error('Error cargando datos de seguridad:', error);
            setLoading(false);
        }
    };

    const blockIP = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('cober_token');
            const response = await fetch('/api/security/block-ip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(blockIpForm)
            });

            if (response.ok) {
                alert('IP bloqueada exitosamente');
                setBlockIpForm({ ip: '', reason: '' });
                loadSecurityData();
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            console.error('Error bloqueando IP:', error);
            alert('Error bloqueando IP');
        }
    };

    const whitelistIP = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('cober_token');
            const response = await fetch('/api/security/whitelist-ip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(whitelistForm)
            });

            if (response.ok) {
                alert('IP agregada a whitelist exitosamente');
                setWhitelistForm({ ip: '', reason: '' });
                loadSecurityData();
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            console.error('Error agregando IP a whitelist:', error);
            alert('Error agregando IP a whitelist');
        }
    };

    const restartFail2Ban = async () => {
        try {
            const token = localStorage.getItem('cober_token');
            const response = await fetch('/api/security/restart-fail2ban', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                alert('Fail2Ban reiniciado exitosamente');
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            console.error('Error reiniciando Fail2Ban:', error);
            alert('Error reiniciando Fail2Ban');
        }
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString('es-ES');
    };

    const getEventColor = (eventType) => {
        const colors = {
            'IP_BLOCKED': 'text-red-600',
            'SUSPICIOUS_ACTIVITY': 'text-yellow-600',
            'IP_WHITELISTED': 'text-green-600',
            'BLOCKED_HIGH_RISK': 'text-red-700',
            'BLOCKED_BLACKLISTED': 'text-red-800'
        };
        return colors[eventType] || 'text-gray-600';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-card rounded-lg shadow-xs border p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Shield className="h-8 w-8 text-blue-600" />
                            <h1 className="mb-4 tracking-tight text-2xl font-bold text-gray-900">
                                Panel de Seguridad
                            </h1>
                        </div>
                        <button
                            onClick={loadSecurityData}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            <RefreshCw className="h-4 w-4" />
                            <span>Actualizar</span>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-card rounded-lg shadow-xs border mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 px-6">
                            {[
                                { id: 'dashboard', label: 'Dashboard', icon: Activity },
                                { id: 'logs', label: 'Logs', icon: Eye },
                                { id: 'control', label: 'Control IPs', icon: Ban }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                                        activeTab === tab.id
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <tab.icon className="h-4 w-4" />
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="p-6">
                        {/* Dashboard Tab */}
                        {activeTab === 'dashboard' && securityStats && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                                    <div className="flex items-center">
                                        <Ban className="h-8 w-8 text-red-600" />
                                        <div className="ml-4">
                                            <p className="mb-4 text-sm font-medium text-red-600">IPs Bloqueadas</p>
                                            <p className="mb-4 text-2xl font-bold text-red-900">
                                                {securityStats.blacklistCount}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                                    <div className="flex items-center">
                                        <AlertTriangle className="h-8 w-8 text-yellow-600" />
                                        <div className="ml-4">
                                            <p className="mb-4 text-sm font-medium text-yellow-600">IPs Sospechosas</p>
                                            <p className="mb-4 text-2xl font-bold text-yellow-900">
                                                {securityStats.suspiciousCount}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                                    <div className="flex items-center">
                                        <CheckCircle className="h-8 w-8 text-green-600" />
                                        <div className="ml-4">
                                            <p className="mb-4 text-sm font-medium text-green-600">IPs Permitidas</p>
                                            <p className="mb-4 text-2xl font-bold text-green-900">
                                                {securityStats.whitelistCount}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                                    <div className="flex items-center">
                                        <Globe className="h-8 w-8 text-blue-600" />
                                        <div className="ml-4">
                                            <p className="mb-4 text-sm font-medium text-blue-600">IPtables Bloqueadas</p>
                                            <p className="mb-4 text-2xl font-bold text-blue-900">
                                                {securityStats.iptablesBlocked || 0}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Logs Tab */}
                        {activeTab === 'logs' && (
                            <div className="space-y-4">
                                <h3 className="mb-4 tracking-tight text-lg font-semibold text-gray-900">Logs de Seguridad Recientes</h3>
                                <div className="space-y-2">
                                    {logs.map((log, index) => (
                                        <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <span className={`font-medium ${getEventColor(log.eventType)}`}>
                                                        {log.eventType}
                                                    </span>
                                                    <span className="text-gray-600">IP: {log.ip}</span>
                                                </div>
                                                <span className="text-sm text-gray-500">
                                                    {formatTimestamp(log.timestamp)}
                                                </span>
                                            </div>
                                            {log.reason && (
                                                <p className="mb-4 text-sm text-gray-600 mt-2">{log.reason}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Control IPs Tab */}
                        {activeTab === 'control' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Bloquear IP */}
                                <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                                    <h3 className="tracking-tight text-lg font-semibold text-red-900 mb-4 flex items-center">
                                        <Ban className="h-5 w-5 mr-2" />
                                        Bloquear IP
                                    </h3>
                                    <form onSubmit={blockIP} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Dirección IP
                                            </label>
                                            <input
                                                type="text"
                                                value={blockIpForm.ip}
                                                onChange={(e) => setBlockIpForm({...blockIpForm, ip: e.target.value})}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                                placeholder="192.168.1.1"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Razón del bloqueo
                                            </label>
                                            <input
                                                type="text"
                                                value={blockIpForm.reason}
                                                onChange={(e) => setBlockIpForm({...blockIpForm, reason: e.target.value})}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                                placeholder="Actividad sospechosa"
                                                required
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                                        >
                                            Bloquear IP
                                        </button>
                                    </form>
                                </div>

                                {/* Agregar a Whitelist */}
                                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                                    <h3 className="tracking-tight text-lg font-semibold text-green-900 mb-4 flex items-center">
                                        <CheckCircle className="h-5 w-5 mr-2" />
                                        Agregar a Whitelist
                                    </h3>
                                    <form onSubmit={whitelistIP} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Dirección IP
                                            </label>
                                            <input
                                                type="text"
                                                value={whitelistForm.ip}
                                                onChange={(e) => setWhitelistForm({...whitelistForm, ip: e.target.value})}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                placeholder="192.168.1.1"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Razón de la autorización
                                            </label>
                                            <input
                                                type="text"
                                                value={whitelistForm.reason}
                                                onChange={(e) => setWhitelistForm({...whitelistForm, reason: e.target.value})}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                placeholder="IP confiable del equipo"
                                                required
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                                        >
                                            Agregar a Whitelist
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Acciones rápidas */}
                <div className="bg-card rounded-lg shadow-xs border p-6">
                    <h3 className="tracking-tight text-lg font-semibold text-gray-900 mb-4">Acciones de Sistema</h3>
                    <div className="flex space-x-4">
                        <button
                            onClick={restartFail2Ban}
                            className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                        >
                            <RefreshCw className="h-4 w-4" />
                            <span>Reiniciar Fail2Ban</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecurityDashboard;
