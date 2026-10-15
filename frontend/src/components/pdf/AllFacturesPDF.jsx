import { Document } from '@react-pdf/renderer'
import { FacturePage } from './FacturePDF'
import { FactureHulioPage } from './FactureHulioPDF'

export default function AllFacturesPDF({ invoices, produits, clients, entreprise = {} }) {
  return (
    <Document author={entreprise.nom || 'Factures'}>
      {invoices.map((inv, i) => (inv.facture.type_facture === 'hulio'
        ? <FactureHulioPage key={i} facture={inv.facture} entreprise={entreprise} />
        : (
          <FacturePage
            key={i}
            facture={inv.facture}
            client={clients.find(c => c.id === inv.facture.client_id)}
            bl={inv.bl}
            produits={produits}
            entreprise={entreprise}
          />
        )
      ))}
    </Document>
  )
}
