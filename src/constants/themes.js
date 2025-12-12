export const themes = [
    {
        id: 'white',
        name: 'White',
        colors: {
            primary: '#ffffff',
            text: '#000000',
            secondary: '#e4e4e7af', // Distinct for white
        }
    },
    {
        id: 'red',
        name: 'Red',
        colors: {
            primary: '#ef4444',
            text: '#ffffff',
            secondary: '#ef4444', // Same as primary
        }
    },
    {
        id: 'orange',
        name: 'Orange',
        colors: {
            primary: '#f97316',
            text: '#ffffff',
            secondary: '#f97316', // Same as primary
        }
    },
    {
        id: 'yellow',
        name: 'Yellow',
        colors: {
            primary: '#eab308',
            text: '#000000',
            secondary: '#eab308', // Same as primary
        }
    },
    {
        id: 'green',
        name: 'Green',
        colors: {
            primary: '#22c55e',
            text: '#ffffff',
            secondary: '#22c55e', // Same as primary
        }
    },
    {
        id: 'blue',
        name: 'Blue',
        colors: {
            primary: '#3b82f6',
            text: '#ffffff',
            secondary: '#3b82f6', // Same as primary
        }
    },
    {
        id: 'purple',
        name: 'Purple',
        colors: {
            primary: '#a855f7',
            text: '#ffffff',
            secondary: '#a855f7', // Same as primary
        }
    },
    {
        id: 'pink',
        name: 'Pink',
        colors: {
            primary: '#ec4899',
            text: '#ffffff',
            secondary: '#ec4899', // Same as primary
        }
    }
];

export const defaultTheme = themes[0];
