const fs = require('fs');
const path = '/app/applet/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const chunk1 = `{result && (
              <button 
                onClick={handleNewAnalysis}
                className="ml-4 text-sm font-medium text-[#0066FF] hover:text-[#0052CC] bg-[#F0F7FF] hover:bg-[#E6F0FF] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                New Analysis
              </button>
            )}`;

const chunk2 = `{user ? (
              <div className="flex items-center gap-3 border-r border-[#E9ECEF] pr-4">
                <span className="text-xs font-medium text-[#495057] truncate max-w-[150px]">{user.email}</span>
                <button 
                  onClick={logout}
                  className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#F8F9FA] rounded text-[#C53030] transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 border-r border-[#E9ECEF] pr-4">
                <button 
                  onClick={loginWithGoogle}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8F9FA] hover:bg-[#E9ECEF] border border-[#DEE2E6] rounded-lg text-sm font-medium transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Save
                </button>
              </div>
            )}`;

const chunk3 = `{videoFile2 ? (
                  <span className="text-xs text-[#6C757D] bg-[#F8F9FA] px-2 py-1 rounded-md">
                    + {(videoFile2.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                ) : (
                  videoFile && result && (
                    <label className="text-xs text-[#0066FF] hover:text-[#0052CC] bg-[#F0F7FF] hover:bg-[#E6F0FF] px-2 py-1 rounded-md cursor-pointer transition-colors font-medium">
                      + Add 2nd Video
                      <input type="file" className="hidden" accept=".mp4,.mov,.avi,.webm,video/mp4,video/quicktime,video/x-msvideo,video/webm" onChange={handleFileChange2} />
                    </label>
                  )
                )}`;

const chunk4 = `{videoFile && (
                  <button 
                    onClick={handleClearVideos}
                    className="text-xs text-[#C53030] hover:text-[#9B2C2C] bg-[#FFF5F5] hover:bg-[#FFE3E3] px-2 py-1 rounded-md cursor-pointer transition-colors font-medium ml-1"
                    title="Remove Video(s)"
                  >
                    <X className="w-3 h-3 inline-block mr-1" />
                    Remove
                  </button>
                )}`;

content = content.replace(chunk1, '');
content = content.replace(chunk2, '');
content = content.replace(chunk3, '');
content = content.replace(chunk4, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
