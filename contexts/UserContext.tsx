"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface UserContextType {
  userId: string | null;
  setUserId: (id: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    const savedId = localStorage.getItem("userId");
    if (savedId) {
      setUserIdState(savedId);
    }

    // Also check URL on initial load
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get("id");
    if (urlId) {
      setUserIdState(urlId);
      localStorage.setItem("userId", urlId);
      
      // Remove ONLY the 'id' parameter from the URL
      params.delete("id");
      const search = params.toString();
      const query = search ? `?${search}` : "";
      const newUrl = window.location.pathname + query + window.location.hash;
      
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const setUserId = (id: string) => {
    setUserIdState(id);
    if (id) {
      localStorage.setItem("userId", id);
    } else {
      localStorage.removeItem("userId");
    }
  };

  return (
    <UserContext.Provider value={{ userId, setUserId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}