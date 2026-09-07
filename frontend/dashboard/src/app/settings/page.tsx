import React from 'react';

/**
 * ESQUELETO - UC-04: Configuración Dinámica de Umbrales
 * Formulario para sobreescribir las reglas del backend dinámicamente.
 *
 * TODO:
 * - Crear el formulario basado en la interfaz `RoomConfig`.
 * - Llamar a la función `updateRoomConfig` al realizar submit.
 */
export default function SettingsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Configuración de Sala (UC-04)</h1>
      <p className="text-gray-600 mb-8">Parámetros operativos para los algoritmos backend.</p>

      <form className="max-w-md border p-6 rounded shadow-sm bg-white">
        <h2 className="text-lg font-semibold mb-4">Editar Umbrales</h2>

        <div className="mb-4">
          <label className="block text-sm mb-1">Temperatura Base (Estructural)</label>
          <input type="number" disabled placeholder="TODO: Implementar Input" className="w-full border p-2 rounded bg-gray-100" />
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1">Minutos críticos inercia térmica</label>
          <input type="number" disabled placeholder="TODO: Implementar Input" className="w-full border p-2 rounded bg-gray-100" />
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1">Temperatura Objetivo Confort</label>
          <input type="number" disabled placeholder="TODO: Implementar Input" className="w-full border p-2 rounded bg-gray-100" />
        </div>

        <button type="button" disabled className="w-full bg-slate-400 text-white p-2 rounded cursor-not-allowed">
          TODO: Botón Implementar Guardado
        </button>
      </form>
    </div>
  );
}
