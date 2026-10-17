"use client";
import { createContext, useContext } from "react";
const Features = createContext({ stay: false, catalog: false });
export const GuestStayFeatures = Features.Provider;
export const useGuestStayFeatures = () => useContext(Features);
