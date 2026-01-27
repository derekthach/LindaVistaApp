export default function Home() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        Linda Vista Motel Management System
      </h1>
      
      <div style={{ maxWidth: '600px', textAlign: 'center' }}>
        <p style={{ marginBottom: '1rem' }}>
          The Next.js migration files were accidentally removed during git cleanup.
        </p>
        
        <p style={{ marginBottom: '2rem', color: '#666' }}>
          Your original Flask application with all features (check-ins, dashboard, analytics) 
          still exists in this repository but needs to be properly set up for Vercel deployment.
        </p>
        
        <div style={{ 
          background: '#f5f5f5', 
          padding: '1.5rem', 
          borderRadius: '8px',
          textAlign: 'left'
        }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
            Available Features in Flask App:
          </h2>
          <ul style={{ lineHeight: '1.8' }}>
            <li>✓ Role-based authentication (Admin/Employee)</li>
            <li>✓ Check-in management system</li>
            <li>✓ Dashboard with analytics and charts</li>
            <li>✓ Room usage tracking</li>
            <li>✓ Monthly revenue reports</li>
            <li>✓ CSV export functionality</li>
            <li>✓ Bilingual support (EN/ES)</li>
          </ul>
        </div>
        
        <p style={{ marginTop: '2rem', color: '#666', fontSize: '0.9rem' }}>
          Contact your developer to restore the Next.js migration or deploy the Flask version.
        </p>
      </div>
    </div>
  )
}
