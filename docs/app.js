const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: 'https://chiliec.github.io/Satoshi/tonconnect-manifest.json',
    buttonRootId: 'connect-button',
    uiOptions: {
        language: 'en',
        uiPreferences: {
            theme: TON_CONNECT_UI.THEME.DARK,
        },
        actionsConfiguration: {
            returnStrategy: 'back',
            // twaReturnUrl: 'https://t.me/our_bot?start=start',
        },
    },
});

const tonweb = new TonWeb(
    new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC', {
        // apiKey: API_KEY,
    }),
);

const contractAddress = 'EQCkdx5PSWjj-Bt0X-DRCfNev6ra1NVv9qqcu-W2-SaToSHI';

function createMessageBody() {
    try {
        const cell = new TonWeb.boc.Cell();
        cell.bits.writeUint(0x00000000, 32);
        const messageText = 'F';
        cell.bits.writeString(messageText);
        return cell;
    } catch (error) {
        console.error('Error in createMessageBody:', error);
        throw new Error(`Failed to create message body: ${error.message}`);
    }
}

async function updateMineButton(wallet) {
    const mineButton = document.getElementById('mineButton');
    if (wallet) {
        mineButton.innerHTML = '<span class="button-icon">⛏️</span> Mine with 0.06 TON';
        document.getElementById('manual-buttons').style.display = 'none';
    } else {
        mineButton.innerHTML = '<span class="button-icon">🔗</span> Connect Wallet';
        document.getElementById('manual-buttons').style.display = 'block';
    }
}

async function initTonConnect() {
    try {
        tonConnectUI.onStatusChange(async (wallet) => {
            console.log('Wallet status changed:', wallet);
            this.updateMineButton(wallet);
        });
        const isRestored = await tonConnectUI.connectionRestored;
        if (isRestored) {
            console.log(
                'Connection restored. Wallet:',
                JSON.stringify({
                    ...tonConnectUI.wallet,
                    ...tonConnectUI.walletInfo,
                }),
            );
        } else {
            console.log('Connection was not restored.');
        }
    } catch (error) {
        console.error('Connection error:', error);
        throw new Error(`Failed to initialize TON Connect: ${error.message}`);
    }
}

async function submitMining() {
    try {
        const wallet = tonConnectUI.wallet;
        if (!wallet) {
            // If wallet is not connected, open the connection modal
            tonConnectUI.openModal();
            return;
        }
        const body = await createMessageBody();
        const payload = btoa(String.fromCharCode(...new Uint8Array(await body.toBoc())));
        if (!payload) {
            throw new Error('Failed to generate payload');
        }
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 120,
            messages: [
                {
                    address: contractAddress,
                    amount: '60000000', // 0.06 TON
                    payload: payload.toString('base64'),
                },
            ],
        };
        const result = await tonConnectUI.sendTransaction(transaction);
        console.log('Transaction sent successfully:', result);
    } catch (error) {
        console.error('Transaction error:', error);
        alert(`Transaction failed: ${error.message}`);
        throw error;
    }
}

function formatAmount(amount) {
    return TonWeb.utils.fromNano(amount.toString());
}

async function getJettonData() {
    try {
        const result = await tonweb.provider.call2(contractAddress, 'get_jetton_data');
        return {
            total_supply: parseInt(result[0]),
            mintable: result[1],
            admin_address: result[2],
            content: result[3],
            wallet_code: result[4],
        };
    } catch (e) {
        console.error('Error getting jetton data:', e);
        return null;
    }
}

async function getMiningData() {
    try {
        const result = await tonweb.provider.call2(contractAddress, 'get_mining_data');
        return {
            last_block: parseInt(result[0]),
            last_block_time: parseInt(result[1]),
            attempts: parseInt(result[2]),
            subsidy: parseInt(result[3]),
            probability: parseInt(result[4]),
        };
    } catch (e) {
        console.error('Error getting mining data:', e);
        return null;
    }
}

async function updateStats() {
    const pluralize = (count, noun, suffix = 's') => `${count} ${noun}${count !== 1 ? suffix : ''}`;
    try {
        const jettonData = await getJettonData();
        if (!jettonData) throw new Error('Failed to get jetton data');

        document.getElementById('supply').textContent =
            `${formatAmount(jettonData.total_supply)} (${(formatAmount(jettonData.total_supply) / 21000000 * 100).toFixed(2)}%)`;
        const isRevoked = jettonData.admin_address === '0:0000000000000000000000000000000000000000000000000000000000000000'
        document.getElementById('rights').textContent = isRevoked ? 'Yes' : 'No';
        document.getElementById('rights').title = isRevoked ? '' : 'Will be revoked soon';

        const miningData = await getMiningData();
        if (!miningData) throw new Error('Failed to get mining data');

        document.getElementById('lastBlock').textContent = miningData.last_block;

        const difference = new Date() - new Date(miningData.last_block_time * 1000);
        const minutes = Math.floor(difference / 60000);
        const seconds = Math.floor((difference % 60000) / 1000);
        const timeText = `${pluralize(minutes, 'minute')} ${pluralize(seconds, 'second')}`;
        document.getElementById('time').textContent = timeText;

        let blocks = (minutes - (minutes % 10)) / 10;
        blocks = blocks === 0 ? 1 : blocks;
        document.getElementById('time').title = pluralize(blocks, 'block');

        document.getElementById('attempts').textContent = miningData.attempts;

        const blockSubsidyHalvingInterval = 210_000;
        document.getElementById('subsidy').textContent = formatAmount(miningData.subsidy) + ' $SATOSHI';
        document.getElementById('subsidy').title =
            miningData.last_block % blockSubsidyHalvingInterval === 0
                ? 'Last block'
                : `${pluralize(blockSubsidyHalvingInterval - (miningData.last_block % blockSubsidyHalvingInterval), 'block')} to next halving`;

        document.getElementById('probability').textContent = miningData.probability + '%';
    } catch (e) {
        console.error('Error updating data:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateMineButton(false);
    initTonConnect();
    updateStats();
});
