import { useState, useEffect } from 'react';

export const useStickyState = (defaultValue, key) => {
    const [value, setValue] = useState(() => {
        try {
            const stickyValue = window.localStorage.getItem(key);
            return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
        } catch (error) {
            return defaultValue;
        }
    });
    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) { }
    }, [key, value]);
    return [value, setValue];
};
