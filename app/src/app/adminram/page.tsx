import { Metadata } from 'next'
import AdminClient from './AdminClient'

export const metadata: Metadata = {
    title: 'Panel de Administración',
    description: 'Gestión de productos, inventario y categorías.',
}

export default function AdminPage() {
    return <AdminClient />
}
