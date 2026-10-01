import { Badge } from '@/components/compat/bootstrap';
import React from 'react';

export const estadosConfig = {
  'Lead': { bg: 'secondary', text: 'Lead' },
  '1º Contacto': { bg: 'info', text: '1º Contacto' },
  'WhatsApp enviado': { color: '#86C6A5', textColor: '#1f2937', text: 'WhatsApp enviado' },
  'Llamada telefónica': { color: '#64748B', textColor: '#fff', text: 'Llamada' },
  'Conversación iniciada por WhatsApp': { color: '#25A566', textColor: '#fff', text: 'Chat WhatsApp' },
  'Promoción aplicada': { color: '#F59E0B', textColor: '#1f2937', text: 'Promo aplicada' },
  'Calificado Cotización': { bg: 'warning', text: 'Cotización' },
  'Calificado Póliza': { bg: 'primary', text: 'Póliza' },
  'Calificado Pago': { bg: 'success', text: 'Pago' },
  'Póliza iniciada': { color: '#818CF8', textColor: '#1f2937', text: 'Póliza iniciada' },
  'Póliza generada': { color: '#4F46E5', textColor: '#fff', text: 'Póliza generada' },
  'Póliza enviada a supervisor': { color: '#0EA5E9', textColor: '#fff', text: 'Env. supervisor' },
  'Póliza pendiente a firma': { color: '#F97316', textColor: '#1f2937', text: 'Pend. firma' },
  'Póliza firmada': { color: '#16A34A', textColor: '#fff', text: 'Firmada' },
  'Venta': { bg: 'success', text: 'Venta' },
  'Fuera de zona': { bg: 'danger', text: 'Fuera zona' },
  'Fuera de edad': { bg: 'danger', text: 'Fuera edad' },
  'No contesta': { bg: 'warning', text: 'No contesta' },
  'No le interesa (económico)': { bg: 'danger', text: 'No interesa' },
  'No le interesa cartilla': { bg: 'danger', text: 'No interesa' },
  'No busca cobertura médica': { bg: 'danger', text: 'No cobertura' },
  'Teléfono erróneo': { bg: 'danger', text: 'Tel. erróneo' },
  'Ya es socio': { bg: 'info', text: 'Ya es socio' },
  'Busca otra Cobertura': { bg: 'warning', text: 'Otra cobertura' },
  'Preexistencia': { bg: 'danger', text: 'Preexistencia' },
  'Reafiliación': { bg: 'info', text: 'Reafiliación' }
};

export const getBadgeEstado = (estado, comentario) => {
  let config = estadosConfig[estado] || { bg: 'secondary', text: estado };
  if (estado === 'Promoción aplicada' && comentario) {
    const match = String(comentario).match(/\((\d+(?:[.,]\d+)?)\s*%/);
    if (match) {
      config = { ...config, text: `Promo ${match[1]}%` };
    }
  }
  if (config.color) {
    return <Badge bg={null} style={{ backgroundColor: config.color, color: config.textColor || '#fff' }}>{config.text}</Badge>;
  }
  return <Badge bg={config.bg}>{config.text}</Badge>;
};