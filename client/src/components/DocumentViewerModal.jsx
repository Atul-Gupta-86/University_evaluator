import React, { useState, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  ExternalLink, 
  FileText, 
  ChevronLeft, 
  ChevronRight,
  Download,
  AlertCircle,
  Layers
} from 'lucide-react';
import { fetchDocumentPageCount } from '../api';

export default function DocumentViewerModal({ 
  documentData, 
  docUrl, 
  docTitle, 
  onClose 
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [imgError, setImgError] = useState(false);

  // Extract raw URL from any possible property passed
  const rawUrl = docUrl || 
    (typeof documentData === 'string' ? documentData : null) ||
    documentData?.copyUrl || 
    documentData?.copy_url || 
    documentData?.fileUrl || 
    documentData?.url || 
    documentData?.secure_url || 
    null;

  const title = docTitle || 
    documentData?.title || 
    (documentData?.enrollmentNumber ? `${documentData.name || 'Candidate'} (${documentData.enrollmentNumber})` : null) ||
    (documentData?.enrollment ? `${documentData.studentName || 'Candidate'} (${documentData.enrollment})` : null) ||
    'Official Scanned Script';

  const resolveInitialPages = () => {
    if (documentData?.totalPages && Number(documentData.totalPages) > 0) {
      return Number(documentData.totalPages);
    }
    if (documentData?.pages && Array.isArray(documentData.pages) && documentData.pages.length > 0) {
      return documentData.pages.length;
    }
    const clean = (rawUrl || '').toLowerCase();
    if (clean.includes('.png') || clean.includes('.jpg') || clean.includes('.jpeg') || clean.includes('.webp')) {
      return 1;
    }
    return 1;
  };

  const [totalPages, setTotalPages] = useState(() => resolveInitialPages());
  const [isLoadingPages, setIsLoadingPages] = useState(false);

  // Dynamically fetch accurate page count from Cloudinary API / backend
  useEffect(() => {
    let isMounted = true;
    const fetchPages = async () => {
      if (!rawUrl) return;
      setIsLoadingPages(true);
      try {
        const count = await fetchDocumentPageCount(rawUrl);
        if (isMounted && count && count > 0) {
          setTotalPages(count);
        }
      } catch (err) {
        console.warn('[DocumentViewer] Could not auto-fetch page count:', err);
      } finally {
        if (isMounted) setIsLoadingPages(false);
      }
    };
    fetchPages();
    return () => { isMounted = false; };
  }, [rawUrl]);

  // Keyboard navigation for page toggling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        setCurrentPage(p => Math.max(1, p - 1));
        setImgError(false);
      } else if (e.key === 'ArrowRight') {
        setCurrentPage(p => Math.min(totalPages, p + 1));
        setImgError(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  if (!rawUrl && !documentData) return null;

  // Cloudinary Deliverable URL resolution for multi-page scripts
  const getDeliverableUrl = (url, page) => {
    if (!url) return null;
    let clean = url.trim();

    // Check if Cloudinary URL
    if (clean.includes('cloudinary.com') && clean.includes('/upload/')) {
      const isPdf = clean.toLowerCase().includes('.pdf');
      
      // If PDF, convert .pdf to .jpg so Cloudinary returns image of page
      if (isPdf) {
        clean = clean.replace(/\.pdf(\?.*)?$/i, '.jpg$1');
      }

      if (clean.includes('/pg_')) {
        clean = clean.replace(/\/pg_\d+\//, `/pg_${page}/`);
      } else {
        clean = clean.replace('/upload/', `/upload/pg_${page}/`);
      }
    }
    return clean;
  };

  const deliverableUrl = rawUrl ? getDeliverableUrl(rawUrl, currentPage) : null;
  const isCloudinary = rawUrl && rawUrl.includes('cloudinary');

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 99999 }}>
      <div 
        className="modal-dialog modal-xl modal-doc-viewer" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '92vh', 
          width: '94vw', 
          maxWidth: '1200px',
          padding: 0,
          borderRadius: '20px',
          overflow: 'hidden',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1.5px solid var(--border-subtle)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="#FC6C26" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{title}</h3>
                <span className="badge" style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px' }}>
                  {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} {isLoadingPages && '...'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {rawUrl && (
              <a 
                href={rawUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-outline btn-sm"
                title="Open original file in new browser window"
                style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={14} /> Open Original Document
              </a>
            )}
            <button 
              type="button" 
              className="btn btn-secondary btn-sm btn-icon-only" 
              onClick={onClose}
              style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Toolbar: Page Navigation, Dropdown Jump & Zoom Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-glass)', padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '12px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          {/* Page Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              className="btn btn-secondary btn-sm"
              disabled={currentPage <= 1}
              onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setImgError(false); }}
              title="Previous Page (Left Arrow)"
            >
              <ChevronLeft size={14} /> Previous
            </button>

            {/* Direct Page Select Dropdown */}
            <select
              value={currentPage}
              onChange={(e) => { setCurrentPage(Number(e.target.value)); setImgError(false); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--border-strong)',
                background: 'var(--surface-glass)',
                color: 'var(--text-main)',
                fontWeight: 800,
                fontSize: '12.5px',
                cursor: 'pointer'
              }}
              title="Jump directly to any page"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>Page {p} of {totalPages}</option>
              ))}
            </select>

            <button 
              className="btn btn-secondary btn-sm"
              disabled={currentPage >= totalPages}
              onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setImgError(false); }}
              title="Next Page (Right Arrow)"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="btn btn-secondary btn-sm btn-icon-only" 
              onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '12px', fontFamily: 'monospace', width: '42px', textAlign: 'center', fontWeight: 600 }}>
              {Math.round(zoom * 100)}%
            </span>
            <button 
              className="btn btn-secondary btn-sm btn-icon-only" 
              onClick={() => setZoom(z => Math.min(3.0, z + 0.15))}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button 
              className="btn btn-secondary btn-sm btn-icon-only" 
              onClick={() => setZoom(1.0)}
              title="Reset Zoom"
            >
              <RotateCw size={14} />
            </button>
          </div>
        </div>

        {/* Quick Page Toggle Strip: Click any page number to jump instantly */}
        {totalPages > 1 && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            background: 'var(--surface-glass-accent)', 
            padding: '8px 24px', 
            borderBottom: '1.5px solid var(--border-subtle)', 
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '6px', color: 'var(--text-main)', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase' }}>
              <Layers size={13} color="var(--accent-orange)" />
              <span>Toggle Page:</span>
            </div>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { setCurrentPage(p); setImgError(false); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1.5px solid var(--border-strong)',
                  background: currentPage === p ? 'var(--accent-orange)' : 'var(--surface-glass)',
                  color: currentPage === p ? '#ffffff' : 'var(--text-main)',
                  fontWeight: currentPage === p ? 800 : 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: currentPage === p ? '0 2px 6px rgba(245, 158, 11, 0.4)' : 'none',
                  minWidth: '32px'
                }}
                title={`Jump to Page ${p}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* High-Resolution Document Canvas */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px' }}>
          {rawUrl ? (
            <div 
              style={{ 
                transform: `scale(${zoom})`, 
                transformOrigin: 'top center', 
                transition: 'transform 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              {!imgError ? (
                <img 
                  src={deliverableUrl || rawUrl} 
                  alt={`Scanned Document Page ${currentPage}`}
                  style={{ 
                    maxWidth: '100%', 
                    boxShadow: '0 10px 35px rgba(0, 0, 0, 0.35)', 
                    border: '1.5px solid var(--border-subtle)', 
                    background: '#ffffff',
                    display: 'block'
                  }}
                  onError={() => setImgError(true)}
                />
              ) : (
                /* Fallback to embedded iframe if direct image transformation isn't available */
                <div style={{ width: '920px', maxWidth: '100%', height: '75vh', background: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.25)', borderRadius: '6px', overflow: 'hidden' }}>
                  <iframe 
                    src={rawUrl} 
                    title="Document Preview"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <AlertCircle size={44} style={{ opacity: 0.5, marginBottom: '12px' }} />
              <h4>No Digital Document File Attached</h4>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>
                This record does not have a scanned copy or reference document URL associated with it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
