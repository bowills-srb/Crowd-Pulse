import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, setToken, getToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          const response = await authApi.getMe();
          setOwner(response.data);
        } catch (error) {
          setToken(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authApi.login({ email, password });
    setToken(response.data.token);
    setOwner(response.data.owner);
    return response.data;
  };

  const register = async (data) => {
    const response = await authApi.register(data);
    setToken(response.data.token);
    setOwner(response.data.owner);
    return response.data;
  };

  const logout = () => {
    setToken(null);
    setOwner(null);
  };

  return (
    <AuthContext.Provider value={{ owner, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
