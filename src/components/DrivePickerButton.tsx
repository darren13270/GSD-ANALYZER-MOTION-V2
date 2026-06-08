import React, { useState, useEffect } from 'react';
import { Cloud, Loader2, X, FileVideo, Folder, ChevronRight } from 'lucide-react';

declare const google: any;

const rawClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const CLIENT_ID = rawClientId.includes('.apps.googleusercontent.com') ? rawClientId : `${rawClientId}.apps.googleusercontent.com`;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
}

interface DrivePickerButtonProps {
  onFileSelect: (file: File) => void;
}

export const DrivePickerButton: React.FC<DrivePickerButtonProps> = ({ onFileSelect }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [searchTarget, setSearchTarget] = useState<'all' | 'shared'>('shared'); // Default to their shared drive
  
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{id: string, name: string}[]>([]);
  
  const SHARED_DRIVE_ID = '0AGT8FnkOJytqUk9PVA';

  const getAccessToken = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        // Use cached token if valid (expires after 1 hour, we check for 50 minutes)
        const cachedToken = sessionStorage.getItem('gsd_drive_token');
        const cachedTime = sessionStorage.getItem('gsd_drive_token_time');
        
        if (cachedToken && cachedTime && (Date.now() - parseInt(cachedTime) < 50 * 60 * 1000)) {
           resolve(cachedToken);
           return;
        }

        const client = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.access_token) {
              sessionStorage.setItem('gsd_drive_token', response.access_token);
              sessionStorage.setItem('gsd_drive_token_time', Date.now().toString());
              resolve(response.access_token);
            } else {
              reject(new Error('Failed to get access token'));
            }
          },
        });
        
        // Only force prompt if it's the very first time in this session to make UX smoother
        const hasSession = sessionStorage.getItem('gsd_drive_has_session');
        client.requestAccessToken(hasSession ? { prompt: '' } : undefined);
        if (!hasSession) sessionStorage.setItem('gsd_drive_has_session', 'true');
        
      } catch (error) {
        reject(error);
      }
    });
  };

  const fetchFiles = async (token: string, target: 'all' | 'shared', folderId?: string) => {
    setIsLoadingFiles(true);
    setSearchTarget(target);
    try {
      let query = "";
      let url = "";

      if (target === 'shared') {
        const targetFolder = folderId || SHARED_DRIVE_ID;
        setCurrentFolderId(targetFolder);
        if (!folderId) {
          setFolderPath([{id: SHARED_DRIVE_ID, name: 'UBISS_GSD (Root)'}]);
        }
        
        // Search inside the target folder and match videos OR folders
        query = `'${targetFolder}' in parents and trashed = false`;
        url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,thumbnailLink)&orderBy=folder desc,name asc&pageSize=100&includeItemsFromAllDrives=true&supportsAllDrives=true&corpora=drive&driveId=${SHARED_DRIVE_ID}`;
      } else {
        query = "mimeType contains 'video/' and trashed = false";
        url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,thumbnailLink)&orderBy=recency desc&pageSize=100&includeItemsFromAllDrives=true&supportsAllDrives=true`;
        setCurrentFolderId(null);
        setFolderPath([]);
      }
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        // Fallback to "all" if corpora=drive fails (e.g. if it's a folder, not a drive)
        if (target === 'shared' && !folderId) {
          console.warn("Target drive fetch failed, falling back to all drives...");
          return fetchFiles(token, 'all');
        }
        throw new Error("Failed to fetch files from Drive");
      }
      
      const data = await response.json();
      const filteredFiles = (data.files || []).filter((f: DriveFile) => 
        f.mimeType === 'application/vnd.google-apps.folder' || f.mimeType.startsWith('video/')
      );
      setFiles(filteredFiles);
    } catch (err) {
      console.error(err);
      alert("Error fetching files from Google Drive.");
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleOpenPicker = async () => {
    if (!CLIENT_ID || !API_KEY) {
      alert("Google Drive integration requires VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY to be set in Environment Variables.");
      return;
    }

    try {
      const token = await getAccessToken();
      setAccessToken(token);
      setShowModal(true);
      fetchFiles(token, 'shared'); // Load the requested shared drive by default
    } catch (err) {
      console.error(err);
      const origin = window.location.origin;
      const isIframe = window.self !== window.top;
      
      let message = `Error authenticating with Google Drive.\n\n`;
      if (isIframe) {
        message += `⚠️ TIP: You are viewing this in an iframe. For Google Drive to work, please click the "Open in new tab" button in the top right of the preview window.\n\n`;
      }
      message += `If you see "redirect_uri_mismatch", ensure this URL is in your Google Console authorized origins:\n${origin}`;
      
      alert(message);
    }
  };

  const handleItemClick = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      if (accessToken) {
        setFolderPath([...folderPath, { id: file.id, name: file.name }]);
        fetchFiles(accessToken, searchTarget, file.id);
      }
    } else {
      handleSelectFile(file);
    }
  };

  const handleSelectFile = async (file: DriveFile) => {
    if (!accessToken) return;
    
    setShowModal(false);
    setIsDownloading(true);
    setDownloadProgress(0);
    
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!response.ok) throw new Error("Failed to download file from Google Drive");
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (!response.body) {
        throw new Error("ReadableStream not yet supported in this browser.");
      }
      
      const reader = response.body.getReader();
      let received = 0;
      const chunks = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total) {
            setDownloadProgress(Math.min(100, Math.round((received / total) * 100)));
          }
        }
      }
      
      const blob = new Blob(chunks, { type: file.mimeType });
      const downloadedFile = new File([blob], file.name, { type: file.mimeType });
      onFileSelect(downloadedFile);
    } catch (err) {
      console.error(err);
      alert("Error downloading video from Drive. Please check console.");
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  return (
    <>
      <button 
        onClick={handleOpenPicker}
        disabled={isDownloading}
        className={`flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-colors ${
          isDownloading 
            ? 'bg-[#E9ECEF] text-[#6C757D] cursor-not-allowed' 
            : 'bg-white border border-[#DEE2E6] text-[#495057] hover:bg-[#F8F9FA] hover:text-[#0066FF] hover:border-[#0066FF]'
        }`}
      >
        {isDownloading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {downloadProgress !== null && downloadProgress > 0 && downloadProgress < 100 
              ? `Downloading... ${downloadProgress}%` 
              : 'Downloading from Drive...'}
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4" />
            Select from Google Drive
          </>
        )}
      </button>

      {/* Custom Picker Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Select Video from Google Drive</h2>
                {window.self !== window.top && (
                  <p className="text-xs text-amber-600 font-medium">Tip: If popup fails, use the "Open in new tab" button ↗️</p>
                )}
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex flex-col gap-3">
              <div className="flex gap-2">
                <button 
                  onClick={() => accessToken && fetchFiles(accessToken, 'shared')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${searchTarget === 'shared' ? 'bg-[#0066FF] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                  UBISS_GSD Drive
                </button>
                <button 
                  onClick={() => accessToken && fetchFiles(accessToken, 'all')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${searchTarget === 'all' ? 'bg-[#0066FF] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                  All My Drives
                </button>
              </div>

              {searchTarget === 'shared' && folderPath.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm bg-white p-2 rounded-lg border border-gray-200">
                  {folderPath.map((crumb, index) => (
                    <React.Fragment key={crumb.id}>
                      {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      <button
                        onClick={() => {
                          if (!accessToken) return;
                          const newPath = folderPath.slice(0, index + 1);
                          setFolderPath(newPath);
                          fetchFiles(accessToken, searchTarget, crumb.id);
                        }}
                        className={`hover:text-[#0066FF] transition-colors ${index === folderPath.length - 1 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingFiles ? (
                <div className="flex justify-center items-center h-48 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col flex-1 min-h-[300px] items-center justify-center text-center p-8 text-gray-500">
                  <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                    <Cloud className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-medium text-gray-900 mb-1">No videos found</p>
                  <p className="text-sm">We couldn't find any video files in your Google Drive.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {files.map((file) => (
                    <div 
                      key={file.id}
                      onClick={() => handleItemClick(file)}
                      className="group cursor-pointer rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all overflow-hidden bg-white"
                    >
                      <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden relative">
                        {file.mimeType === 'application/vnd.google-apps.folder' ? (
                          <Folder className="w-12 h-12 text-blue-400 group-hover:scale-110 transition-transform duration-300" />
                        ) : file.thumbnailLink ? (
                          <img 
                            src={file.thumbnailLink} 
                            alt={file.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <FileVideo className="w-10 h-10 text-gray-400" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-gray-800 truncate" title={file.name}>
                          {file.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
