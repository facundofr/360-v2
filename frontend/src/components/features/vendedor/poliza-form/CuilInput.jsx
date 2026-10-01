import React, { useEffect, useRef, useState } from "react";
import { Form } from "@/components/compat/bootstrap";

export const normalizarDni = (dni) => String(dni ?? '').replace(/\D/g, '');

// Parte central del CUIL: el DNI completado con ceros a la izquierda hasta 8 dígitos
const cuerpoDesdeDni = (dni) => {
  const digitos = normalizarDni(dni);
  return digitos.length >= 7 && digitos.length <= 8 ? digitos.padStart(8, '0') : '';
};

// Dígito verificador según el algoritmo módulo 11 de AFIP
const PESOS_CUIL = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const verificadorCorrecto = (cuil) => {
  const suma = PESOS_CUIL.reduce((acc, peso, i) => acc + Number(cuil[i]) * peso, 0);
  const resto = 11 - (suma % 11);
  return (resto === 11 ? 0 : resto) === Number(cuil[10]);
};

// Posiciones del cursor dentro de "XX-XXXXXXXX-X"
const POS_VERIFICADOR = 12;
const POS_FINAL = 13;

const componer = (p, v, c) => (p.length === 2 && c.length === 8 && v.length === 1 ? `${p}${c}${v}` : '');

/**
 * CUIL en un solo campo con máscara "__-DNI-_": el medio se completa solo con el DNI y
 * el usuario carga prefijo y dígito verificador. Emite los 11 dígitos únicamente cuando
 * está completo; mientras tanto emite '' para que la validación lo siga contando como faltante.
 */
const CuilInput = ({ dni, value, onChange, isInvalid = false, required = true }) => {
  const cuerpo = cuerpoDesdeDni(dni);
  const guardado = normalizarDni(value);
  const completo = guardado.length === 11;

  const [prefijo, setPrefijo] = useState(completo ? guardado.slice(0, 2) : '');
  const [verificador, setVerificador] = useState(completo ? guardado.slice(10) : '');
  const inputRef = useRef(null);
  const cuerpoAnterior = useRef(cuerpo);

  // Si el CUIL llega completo desde afuera (p. ej. al cargar una póliza), reflejarlo
  useEffect(() => {
    if (completo) {
      setPrefijo(guardado.slice(0, 2));
      setVerificador(guardado.slice(10));
    }
  }, [guardado, completo]);

  // Al editar el DNI se recompone el CUIL. No se toca un CUIL que llega junto con el
  // DNI en la carga inicial, para no pisar datos guardados.
  useEffect(() => {
    const previo = cuerpoAnterior.current;
    if (previo === cuerpo) return;
    cuerpoAnterior.current = cuerpo;
    if (!previo && completo) return;
    const nuevo = componer(
      completo ? guardado.slice(0, 2) : prefijo,
      completo ? guardado.slice(10) : verificador,
      cuerpo
    );
    if (nuevo !== guardado) onChange(nuevo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuerpo]);

  const mostrado = cuerpo ? `${prefijo.padEnd(2, '_')}-${cuerpo}-${verificador || '_'}` : '';

  // Próximo lugar a completar: prefijo, luego verificador
  const posPendiente = (p, v) => (p.length < 2 ? p.length : v ? null : POS_VERIFICADOR);

  // Se ubica después de que React reescriba el valor controlado del input
  const ubicarCursor = (pos) => {
    if (pos === null) return;
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(pos, pos));
  };

  const aplicar = (p, v) => {
    setPrefijo(p);
    setVerificador(v);
    onChange(componer(p, v, cuerpo));
    ubicarCursor(posPendiente(p, v) ?? POS_FINAL);
  };

  const handleChange = (e) => {
    const texto = e.target.value;
    const partes = texto.split('-');
    if (!normalizarDni(texto)) {
      aplicar('', '');
    } else if (partes.length === 3 && normalizarDni(partes[1]) === cuerpo) {
      aplicar(normalizarDni(partes[0]).slice(0, 2), normalizarDni(partes[2]).slice(-1));
    } else if (texto.length < mostrado.length) {
      // Borraron sobre la parte fija (guion o DNI): se borra el último dígito del prefijo
      aplicar(prefijo.slice(0, -1), verificador);
    } else {
      // Escribieron sobre la parte fija: se ignora
      ubicarCursor(posPendiente(prefijo, verificador) ?? POS_FINAL);
    }
  };

  // Si pegan el CUIL completo, se toman prefijo y verificador (el medio sale del DNI)
  const handlePaste = (e) => {
    const digitos = normalizarDni(e.clipboardData.getData('text'));
    if (digitos.length !== 11) return;
    e.preventDefault();
    aplicar(digitos.slice(0, 2), digitos.slice(10));
  };

  const noCoincideConDni = completo && cuerpo && guardado.slice(2, 10) !== cuerpo;
  const verificadorErroneo = completo && !noCoincideConDni && !verificadorCorrecto(guardado);

  return (
    <>
      <Form.Control
        ref={inputRef}
        size="lg"
        inputMode="numeric"
        autoComplete="off"
        value={mostrado}
        onChange={handleChange}
        onPaste={handlePaste}
        onFocus={() => ubicarCursor(posPendiente(prefijo, verificador))}
        placeholder="Completá primero el DNI"
        readOnly={!cuerpo}
        required={required}
        pattern="\d{2}-\d{8}-\d"
        title="Completá prefijo y dígito verificador"
        isInvalid={isInvalid}
        style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em' }}
        aria-label="CUIL"
      />
      {noCoincideConDni && (
        <Form.Text className="text-warning">
          El CUIL guardado ({guardado}) no corresponde a este DNI.
        </Form.Text>
      )}
      {verificadorErroneo && (
        <Form.Text className="text-warning">
          Dígito verificador incorrecto: revisá el CUIL.
        </Form.Text>
      )}
    </>
  );
};

export default CuilInput;
