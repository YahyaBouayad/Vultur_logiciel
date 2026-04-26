import { Document } from '@react-pdf/renderer'
import { FacturePage } from './FacturePDF'

export default function AllFacturesPDF({ invoices, produits, clients, entreprise = {} }) {
  return (
    <Document author={entreprise.nom || 'Factures'}>
      {invoices.map((inv, i) => (
        <FacturePage
          key={i}
          facture={inv.facture}
          client={clients.find(c => c.id === inv.facture.client_id)}
          bl={inv.bl}
          produits={produits}
          entreprise={entreprise}
        />
      ))}
    </Document>
  )
}
