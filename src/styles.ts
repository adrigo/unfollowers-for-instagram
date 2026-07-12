export const CSS_STYLES = `
  #iu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(10, 9, 8, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 999999;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #f7f1e8;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    overscroll-behavior: contain;
  }

  .iu-card {
    width: 95%;
    max-width: 820px;
    height: 85vh;
    background: rgba(22, 20, 18, 0.85);
    border: 1px solid rgba(247, 241, 232, 0.08);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: iu-fade-in 0.3s ease-out;
  }

  @keyframes iu-fade-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .iu-header {
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.2);
  }

  .iu-title-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .iu-logo {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #f97316, #ec4899, #7c3aed);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.1rem;
    color: #fff;
  }

  .iu-title {
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .iu-close-btn {
    background: transparent;
    border: none;
    color: #ada79d;
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;
    padding: 0.25rem;
    transition: color 0.2s;
  }

  .iu-close-btn:hover {
    color: #fff;
  }

  .iu-body {
    flex: 1;
    padding: 1.25rem 1.5rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    overscroll-behavior: contain;
  }

  /* Two-column layout elements */
  .iu-layout-wrapper {
    display: flex;
    gap: 1.5rem;
    height: 100%;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .iu-sidebar {
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    padding-right: 1.25rem;
    overflow-y: auto;
    height: 100%;
    box-sizing: border-box;
  }
  
  .iu-sidebar::-webkit-scrollbar {
    width: 4px;
  }
  .iu-sidebar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
  }

  .iu-sidebar-section {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 0.85rem;
  }

  .iu-stats-vertical {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .iu-stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #ada79d;
    padding: 0.15rem 0;
  }

  .iu-content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
  }

  @media (max-width: 650px) {
    .iu-card {
      height: 90vh;
    }
    .iu-body {
      padding: 1rem;
    }
    .iu-layout-wrapper {
      flex-direction: column;
      gap: 0.75rem;
    }
    .iu-sidebar {
      width: 100%;
      height: auto;
      border-right: none;
      padding-right: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 0.75rem;
      overflow-y: visible;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .iu-sidebar-section {
      flex: 1 1 calc(50% - 0.375rem);
      min-width: 140px;
      border-bottom: none;
      padding-bottom: 0;
    }
    .iu-sidebar-section:first-child {
      flex: 1 1 100%;
    }
    .iu-sidebar-section:last-child {
      border-bottom: none;
    }
    .iu-content-area {
      height: auto;
      flex: 1;
      min-height: 0;
    }
  }

  /* Scanning State styles */
  .iu-scanner-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 2rem;
    text-align: center;
  }

  .iu-spinner {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 20%, #f97316, #ec4899, #7c3aed);
    position: relative;
    animation: iu-spin 0.8s linear infinite;
  }

  .iu-spinner::after {
    content: '';
    position: absolute;
    top: 5px;
    left: 5px;
    right: 5px;
    bottom: 5px;
    background: #161412;
    border-radius: 50%;
  }

  @keyframes iu-spin {
    to { transform: rotate(360deg); }
  }

  .iu-progress-bar-container {
    width: 100%;
    max-width: 350px;
    height: 6px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 99px;
    overflow: hidden;
  }

  .iu-progress-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #f97316, #ec4899);
    transition: width 0.2s ease;
  }

  /* List State styles */

  .iu-search-input {
    flex: 1;
    min-width: 0;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    color: #fff;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .iu-search-input:focus {
    border-color: #ec4899;
    box-shadow: 0 0 10px rgba(236, 72, 153, 0.15);
  }

  .iu-btn-export {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.75rem 1.1rem;
    color: #fff;
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .iu-btn-export:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .iu-btn-export:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }


  .iu-filter-label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    cursor: pointer;
    user-select: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .iu-filter-label:hover {
    color: #fff;
  }

  .iu-filter-label input[type="checkbox"] {
    cursor: pointer;
    accent-color: #ec4899;
    width: 15px;
    height: 15px;
  }

  .iu-filter-label input[type="checkbox"]:disabled {
    cursor: not-allowed;
  }

  .iu-list-container {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-right: 0.25rem;
    overscroll-behavior: contain;
  }

  .iu-list-container::-webkit-scrollbar {
    width: 6px;
  }
  .iu-list-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  .iu-user-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 12px;
    padding: 0.5rem 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: border-color 0.2s;
    position: relative;
  }

  .iu-user-card:hover {
    border-color: rgba(236, 72, 153, 0.3);
    background: rgba(255, 255, 255, 0.04);
    box-shadow: 0 0 12px rgba(236, 72, 153, 0.08);
  }

  .iu-user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .iu-user-checkbox {
    cursor: pointer;
    accent-color: #ec4899;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .iu-user-checkbox:disabled {
    cursor: not-allowed;
  }

  .iu-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .iu-names {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .iu-username,
  .iu-username:link,
  .iu-username:visited,
  .iu-username:hover,
  .iu-username:active {
    font-weight: 700 !important;
    color: #fff !important;
    text-decoration: none !important;
    font-size: 0.95rem !important;
  }

  .iu-username:hover {
    text-decoration: underline !important;
  }

  .iu-fullname {
    font-size: 0.8rem;
    color: #ada79d;
  }

  .iu-username-wrapper {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
  }

  .iu-card-badges {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.25rem;
  }

  .iu-unfollow-btn {
    background: #ef4444;
    border: none;
    color: #fff;
    border-radius: 8px;
    padding: 0.5rem 1rem;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: opacity 0.2s, background 0.2s;
  }

  .iu-unfollow-btn:hover:not(:disabled) {
    background: #dc2626;
  }

  .iu-unfollow-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Grid Layout for Cards */
  .iu-list-container.grid-view {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 0.75rem;
  }

  .iu-list-container.grid-view .iu-user-card {
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    padding: 1rem 0.75rem 0.85rem;
    gap: 0.75rem;
    min-height: 190px;
  }

  .iu-list-container.grid-view .iu-user-checkbox {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
  }

  .iu-list-container.grid-view .iu-user-info {
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .iu-list-container.grid-view .iu-names {
    align-items: center;
  }

  .iu-list-container.grid-view .iu-username-wrapper {
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
  }

  .iu-list-container.grid-view .iu-card-badges {
    justify-content: center;
  }

  .iu-list-container.grid-view .iu-avatar {
    width: 48px;
    height: 48px;
  }

  .iu-list-container.grid-view .iu-unfollow-btn {
    width: 100%;
  }

  .iu-sidebar-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .iu-btn-group {
    display: flex;
    gap: 0.5rem;
    width: 100%;
  }

  .iu-filter-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .iu-content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding: 0 0.25rem;
    flex-shrink: 0;
  }

  #iu-bulk-progress-banner {
    display: none;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.25);
    padding: 0.75rem 1rem;
    border-radius: 12px;
    align-items: center;
    justify-content: space-between;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .iu-stat-val {
    font-weight: 700;
  }
  .iu-stat-val.non-followers {
    color: #ef4444;
  }
  .iu-stat-val.followers {
    color: #34d399;
  }
  .iu-stat-val.verified {
    color: #0095f6;
  }
  .iu-stat-val.private {
    color: #ffd082;
  }
  .iu-stat-val.new-unfollowers {
    color: #f472b6;
  }


  /* Custom Dropdown Styles */
  .iu-custom-dropdown {
    position: relative;
    width: 100%;
    user-select: none;
  }
  .iu-dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.65rem;
    background: #1a1a1a;
    border: 1px solid #363636;
    border-radius: 8px;
    color: #dbdbdb;
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }
  .iu-dropdown-trigger:hover {
    border-color: #555;
    background: #222;
  }
  .iu-dropdown-options {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #1a1a1a;
    border: 1px solid #363636;
    border-radius: 8px;
    margin-top: 0.25rem;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    overflow: hidden;
  }
  .iu-dropdown-options.show {
    display: block;
  }
  .iu-dropdown-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 0.65rem;
    color: #dbdbdb;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }
  .iu-dropdown-option:hover {
    background: #262626;
    color: #fff;
  }
`;
