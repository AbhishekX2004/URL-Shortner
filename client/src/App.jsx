/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Copy, BarChart3, ExternalLink, Loader2, Check, AlertCircle, Clock, MousePointer } from 'lucide-react';
import axios from 'axios';
import "./App.css";

const App = () => {
  const [url, setUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [recentUrls, setRecentUrls] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // API
  const API = import.meta.env.VITE_API;

  // timestamp converter
  const toDate = (ts) => {
    if (!ts) return null;

    // Firestore Timestamp object
    if (typeof ts.toDate === 'function') return ts.toDate();

    // ISO string or epoch ms
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);

    // Serialized Firestore objects from APIs
    const s = ts.seconds ?? ts._seconds;
    const ns = ts.nanoseconds ?? ts._nanoseconds;

    if (typeof s === 'number') {
      const ms = s * 1000 + Math.floor((ns ?? 0) / 1e6);
      return new Date(ms);
    }

    return null;
  };

  const formatTimestamp = (timestamp) => {
    const d = toDate(timestamp);
    if (!d || isNaN(d)) return '—';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Redirect if path has a short code
  useEffect(() => {
    const path = window.location.pathname;
    const potentialShortCode = path.substring(1);

    if (potentialShortCode && potentialShortCode.length === 6 && /^[a-zA-Z0-9]+$/.test(potentialShortCode)) {
      setIsRedirecting(true);
      window.location.href = `${API}/url/${potentialShortCode}`;
    }
  }, [API]);

  // Fetch recent URLs
  useEffect(() => {
    if (!shortUrl) fetchRecentUrls();
  }, [shortUrl]);

  const fetchRecentUrls = async () => {
    setLoadingRecent(true);
    try {
      const response = await axios.get(`${API}/recent?limit=5`);
      setRecentUrls(response.data.urls || []);
    } catch (err) {
      console.error('Failed to fetch recent URLs:', err);
    } finally {
      setLoadingRecent(false);
    }
  };

  const shortenUrl = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API}/shorten`, { originalUrl: url.trim() });
      const data = response.data;
      setShortUrl(data.shortUrl);
      setShortCode(data.shortCode);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to shorten URL';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (textToCopy) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const fetchStats = async () => {
    if (!shortCode) return;
    try {
      const response = await axios.get(`${API}/stats/${shortCode}`);
      setStats(response.data);
      setShowStats(true);
    } catch (err) {
      console.error('Failed to fetch stats:', err.response?.data?.error || err.message);
    }
  };

  const reset = () => {
    setUrl('');
    setShortUrl('');
    setShortCode('');
    setError('');
    setStats(null);
    setShowStats(false);
    setCopied(false);
    window.history.pushState({}, '', '/');
    fetchRecentUrls();
  };

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Redirecting...</h2>
          <p className="text-gray-600">Please wait while we redirect you to the original URL</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <motion.div
              animate={{ rotate: shortUrl ? 360 : 0 }}
              transition={{ duration: 0.5 }}
              className="p-3 bg-indigo-100 rounded-full mr-3"
            >
              <Link2 className="w-8 h-8 text-indigo-600" />
            </motion.div>
            <h1 className="text-4xl font-bold text-gray-800">URL Shortener</h1>
          </div>
          <p className="text-gray-600 max-w-md mx-auto">
            Transform long URLs into short, shareable links with click tracking
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl p-8 mb-8"
        >
          {/* URL Input Section */}
          <AnimatePresence mode="wait">
            {!shortUrl ? (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter your long URL
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setError('');
                      }}
                      placeholder="https://example.com/very-long-url..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                      onKeyDown={(e) => e.key === 'Enter' && shortenUrl()}
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={shortenUrl}
                      disabled={loading || !url.trim()}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors duration-200 flex items-center gap-2 sm:w-auto w-full"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Link2 className="w-5 h-5" />
                      )}
                      {loading ? 'Shortening...' : 'Shorten'}
                    </motion.button>
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg"
                  >
                    <AlertCircle className="w-5 h-5" />
                    {error}
                  </motion.div>
                )}
              </motion.div>
            ) : (
              /* Result Section */
              <motion.div
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="w-8 h-8 text-green-600" />
                  </motion.div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    URL Shortened Successfully!
                  </h3>
                </div>

                {/* Original URL */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Original URL:
                  </label>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="truncate flex-1">{url}</span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </div>

                {/* Short URL */}
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-indigo-700 mb-2">
                    Your shortened URL:
                  </label>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 text-base sm:text-lg font-mono text-indigo-800 bg-white px-3 py-1 rounded border truncate">
                      {shortUrl}
                    </code>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => copyToClipboard(shortUrl)}
                      className="px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      )}
                      {copied ? 'Copied!' : 'Copy'}
                    </motion.button>
                  </div>
                </div>


                {/* Action Buttons */}
                <div className="flex gap-3 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={fetchStats}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    View Stats
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={reset}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                  >
                    Shorten Another
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Recent URLs Section */}
        {!shortUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-xl p-6 mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Recently Shortened URLs
              </h3>
              <button
                onClick={fetchRecentUrls}
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors"
              >
                Refresh
              </button>
            </div>

            {loadingRecent ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : recentUrls.length > 0 ? (
              <div className="space-y-3">
                {recentUrls.map((recentUrl, index) => (
                  <motion.div
                    key={recentUrl.shortCode}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono text-indigo-600 font-medium">
                          /{recentUrl.shortCode}
                        </code>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MousePointer className="w-3 h-3" />
                          {recentUrl.clicks} clicks
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate mb-1">
                        {recentUrl.originalUrl}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Created: {formatTimestamp(recentUrl.createdAt)}</span>
                        {recentUrl.lastAccessed && (
                          <span>Last accessed: {formatTimestamp(recentUrl.lastAccessed)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => copyToClipboard(`${window.location.origin}/${recentUrl.shortCode}`)}
                        className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </motion.button>
                      <a
                        href={recentUrl.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No recent URLs found</p>
                <p className="text-sm">Start by shortening your first URL!</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Stats Card */}
        <AnimatePresence>
          {showStats && stats && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl p-6 mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                  URL Statistics
                </h3>
                <button
                  onClick={() => setShowStats(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.clicks || 0}</div>
                  <div className="text-sm text-blue-700">Total Clicks</div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{shortCode}</div>
                  <div className="text-sm text-green-700">Short Code</div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {formatTimestamp(stats.createdAt) || 'Today'}
                  </div>
                  <div className="text-sm text-purple-700">Created On</div>
                </div>
              </div>

              {stats.lastAccessed && (
                <div className="mt-4 p-4 bg-orange-50 rounded-lg text-center">
                  <div className="text-lg font-bold text-orange-600">
                    {formatTimestamp(stats.lastAccessed)}
                  </div>
                  <div className="text-sm text-orange-700">Last Accessed</div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-12 text-gray-500"
        >
          <p>Made with ❤️ by Abhishek Verma</p>
        </motion.div>
      </div>
    </div>
  );
};

export default App;
