import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Loader2 } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate('/generate');
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 hero-gradient">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-panel p-8 rounded-3xl border border-brand-border relative overflow-hidden"
      >
        <div className="flex justify-center mb-8">
          <div className="p-3 bg-brand-primary/20 rounded-2xl">
            <BrainCircuit className="w-10 h-10 text-brand-primary" />
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-center mb-2 text-brand-text">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>
        <p className="text-brand-muted text-center mb-8">
          {isLogin ? "Enter your credentials to access your flashcards." : "Sign up to start saving your flashcard sets."}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-brand-muted mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-brand-bg text-brand-text border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary focus:outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-muted mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-brand-bg text-brand-text border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary focus:outline-none transition-all"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="mt-4 w-full bg-brand-primary hover:bg-brand-primary-hover text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-brand-primary/30 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "Sign In" : "Sign Up")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-brand-muted hover:text-brand-primary transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
