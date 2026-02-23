"use client";

import { useState } from "react";
import { updatePricesFromJson } from "./actions";

export default function AdminPrecios() {
    const [jsonInput, setJsonInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [errors, setErrors] = useState<string[]>([]);

    const handleUpdate = async () => {
        setIsLoading(true);
        setMessage("");
        setErrors([]);
        try {
            const result = await updatePricesFromJson(jsonInput);
            setMessage(result.message);
            if (result.errors) {
                setErrors(result.errors);
            }
        } catch (err: any) {
            setMessage("Ocurrió un error inesperado al actualizar.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-2">Editor de Precios (Carga Masiva)</h1>
            <p className="mb-6 text-gray-500">
                Pega un JSON con el formato del proveedor (GCgroup) para actualizar todos los precios en USD de la base de datos.
            </p>

            <textarea
                className="w-full h-80 p-4 border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-900 rounded font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                placeholder='{ "productos": [ { "id": 1, "nombre": "IPHONE 15 128 GB SIM/ESIM", "precio": 705, "categoria": "CELULARES IPHONE NEW" } ] }'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
            />

            <button
                onClick={handleUpdate}
                disabled={isLoading || jsonInput.trim() === ""}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded shadow transition-all disabled:opacity-50"
            >
                {isLoading ? "Procesando..." : "Actualizar Precios"}
            </button>

            {message && (
                <div className={`mt-6 p-4 rounded border-l-4 ${message.includes("Error") ? 'bg-red-50 border-red-500 text-red-800' : 'bg-green-50 border-green-500 text-green-800'}`}>
                    <p className="font-semibold">{message}</p>
                </div>
            )}

            {errors.length > 0 && (
                <div className="mt-4 p-4 rounded bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800">
                    <h3 className="font-bold mb-2">Advertencias al actualizar:</h3>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                        {errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
