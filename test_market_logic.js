// Test script to validate market close transition logic
// This simulates the logic without DOM dependencies

// Mock the isMarketOpen function
function isMarketOpen() {
    // Simulate Eastern Time market hours check
    const now = new Date();
    const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = etNow.getDay();
    const hour = etNow.getHours();
    const minute = etNow.getMinutes();

    // Check if it's a weekday (Monday = 1, Friday = 5)
    if (day >= 1 && day <= 5) {
        // Check if it's between 9:30 AM and 4:00 PM ET
        if ((hour === 9 && minute >= 30) || (hour > 9 && hour < 16) || (hour === 16 && minute === 0)) {
            return true;
        }
    }
    return false;
}

// Mock the getDefaultSymbol function
function getDefaultSymbol() {
    const now = new Date();
    const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = etNow.getDay();
    const hours = etNow.getHours();
    const minutes = etNow.getMinutes();
    
    // Check if it's a weekend
    const isWeekend = day === 0 || day === 6; // Sunday or Saturday
    
    // Check if it's a weekday during market hours (9:30AM - 4:00PM ET)
    const isMarketHours = !isWeekend && 
                         (hours > 9 || (hours === 9 && minutes >= 30)) && 
                         (hours < 16);
    
    if (isWeekend || !isMarketHours) {
        return 'BTC-USD'; // Default to Bitcoin on weekends and outside market hours
    } else {
        return '^IXIC'; // Default to NASDAQ during market hours on weekdays
    }
}

// Test the auto-refresh logic
function testAutoRefreshLogic() {
    console.log('=== Testing Market Close Transition Logic ===\n');
    
    // Test current market status
    const currentMarketStatus = isMarketOpen();
    const defaultSymbol = getDefaultSymbol();
    
    console.log(`Current time (ET): ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
    console.log(`Market is open: ${currentMarketStatus}`);
    console.log(`Default symbol: ${defaultSymbol}`);
    
    // Test the transition logic
    let currentSymbol = '^IXIC'; // Simulate starting with NASDAQ
    const isCrypto = currentSymbol.endsWith('-USD');
    
    console.log(`\nStarting with symbol: ${currentSymbol}`);
    console.log(`Is crypto: ${isCrypto}`);
    
    // Simulate the auto-refresh check
    const shouldSwitchToCrypto = !isMarketOpen() && !currentSymbol.endsWith('-USD');
    
    console.log(`Should switch to crypto: ${shouldSwitchToCrypto}`);
    
    if (shouldSwitchToCrypto) {
        console.log('✅ Logic would switch to BTC-USD');
        currentSymbol = 'BTC-USD';
    } else {
        console.log('✅ Logic would continue with current symbol');
    }
    
    console.log(`\nFinal symbol: ${currentSymbol}`);
    
    // Test edge cases
    console.log('\n=== Testing Edge Cases ===');
    
    // Test with crypto symbol
    const cryptoSymbol = 'BTC-USD';
    const cryptoShouldSwitch = !isMarketOpen() && !cryptoSymbol.endsWith('-USD');
    console.log(`Crypto symbol ${cryptoSymbol} should switch: ${cryptoShouldSwitch} (should be false)`);
    
    // Test with different symbols
    const testSymbols = ['AAPL', 'GOOGL', 'ETH-USD', '^DJI'];
    testSymbols.forEach(symbol => {
        const shouldSwitch = !isMarketOpen() && !symbol.endsWith('-USD');
        console.log(`${symbol} should switch: ${shouldSwitch}`);
    });
    
    console.log('\n=== Test Complete ===');
}

// Run the test
testAutoRefreshLogic(); 