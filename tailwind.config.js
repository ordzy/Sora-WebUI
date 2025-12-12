h/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#000000', // OLED Black
                surface: '#121212', // Slightly lighter for cards
                primary: '#ffffff', // White text
                secondary: '#a1a1aa', // Gray text
                accent: '#3b82f6', // Blue accent (can be changed)
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
