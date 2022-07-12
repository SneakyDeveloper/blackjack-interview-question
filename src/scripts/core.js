$('#ui-bar').remove();
$(document.head).find('#style-ui-bar').remove();

// BlackjackGame exposes three methods to play a one-person blackjack game.
//   deal, hit, and stay.
//
// Currently requires two HTML elements, with the IDs playerHand and dealerHand.
class BlackjackGame {
    constructor(numDecks, dealerHitsSoft17 = false) {
        this.deck = new Deck(numDecks);
        this.deck.shuffle();
        // Reshuffle when there's only a quarter of the deck left.
        this.reshuffleAt = Math.floor((numDecks * 52) / 4);
        this.hitsSoft17 = dealerHitsSoft17;
    }

    deal() {
        if (!this.playing) {
            this._reset();
            this.playing = true;

            this._playerDraw();
            this._playerDraw();

            this._dealerDraw();

            const playerNatural = this._calcHand(this.playerHand).score === 21 && this.playerHand.length === 2;
            if (playerNatural) {
                this.stay();
            }
        }
    }

    hit() {
        if (this.playing) {
            this._playerDraw();
        }
    }

    stay() {
        if (!this.playing) {
            return;
        }

        this.playing = false;

        const playerScore = this._calcHand(this.playerHand).score;
        if (playerScore > 21) {
            this._setOutcome('Player busted! Player loses.');
            return;
        }

        const playerNatural = playerScore === 21 && this.playerHand.length === 2;

        this._dealerPlay();
        const dealerScore = this._calcHand(this.dealerHand).score;
        const dealerNatural = dealerScore === 21 && this.dealerHand.length === 2;

        if (playerNatural && !dealerNatural) {
            this._setOutcome('Player natural! Player wins.');
        } else if (!playerNatural && dealerNatural) {
            this._setOutcome('Dealer natural! Player loses.');
        } else if (dealerScore > 21) {
            this._setOutcome('Dealer busted! Player wins.');
        } else if (playerScore > dealerScore) {
            this._setOutcome('Player wins.');
        } else if (playerScore < dealerScore) {
            this._setOutcome('Player loses.');
        } else {
            this._setOutcome(`It's a draw!`);
        }
    }

    _dealerPlay() {
        this._dealerDraw();

        const playerNatural = this._calcHand(this.playerHand).score === 21 && this.playerHand === 2;
        let hand = this._calcHand(this.dealerHand);
        const dealerNatural = hand.score === 21 && this.dealerHand.length === 2;
        if (playerNatural || dealerNatural) {
            return;
        }

        while (true) {
            const score = hand.score;

            if (score === 21) {
                break;
            }
            
            if (score < 17) {
                this._dealerDraw();
            } else if (this.hitsSoft17 && score === 17 && hand.aces > 0) {
                this._dealerDraw();
            } else {
                break;
            }

            hand = this._calcHand(this.dealerHand);
        }
    }

    // playerDraw draws a card for the player, and ends the game
    // if the player busts.
    _playerDraw() {
        this.playerHand.push(this.deck.draw());
        this._updatePlayerGraphics();
        if (this._isBust(this.playerHand)) {
            this.stay();
        }
    }

    // dealerDraw draws a card for the dealer.
    _dealerDraw() {
        this.dealerHand.push(this.deck.draw());
        this._updateDealerGraphics();
    }

    _updatePlayerGraphics() {
        this._updateGraphics("Player", this.playerHand, '#playerHand');
    }

    _updateDealerGraphics() {
        this._updateGraphics("Dealer", this.dealerHand, '#dealerHand');
    }

    _updateGraphics(owner, hand, selector) {
        const html = this._generateHandHtml(owner, hand);
        $(selector).html(html);
    }

    // generateHandHtml generates HTML to display the score and cards of a hand,
    // displaying the hard value of the hand in parentheses if it's a soft hand.
    _generateHandHtml(owner, hand) {
        const calcHand = this._calcHand(hand);
        const lowScore = calcHand.score !== calcHand.lowScore ? ` (${calcHand.lowScore})` : '';
        let html = `${owner}'s hand: ${calcHand.score}${lowScore}<br/>`;
        for (const card of hand) {
            html += `<img class="card" src="${card.imagePath()}"/>`;
        }
        return html;
    }

    _isBust(hand) {
        return this._calcHand(hand).score > 21; 
    }

    _setOutcome(str) {
        $('#mainLog').text(str);
    }

    _calcHand(hand) {
        let aces = 0;
        let score = 0;
        let lowScore = 0;
        // Tally up the score, keeping track of how many aces there are.
        for (const card of hand) {
            switch (card.value) {
                case 11: case 12: case 13:
                    score += 10;
                    lowScore += 10;
                    break;
                case 14:
                    score += 11;
                    lowScore++;
                    aces++;
                    break;
                default:
                    score += card.value;
                    lowScore += card.value;
                    break;
            }
        }
        // In case of a bust, if there are aces left we can remove 10 at a time.
        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }
        return { score, lowScore, aces };
    }

    _reset() {
        this.playing = false;
        this.playerHand = [];
        this.dealerHand = [];
        if (this.deck.cards.length <= this.reshuffleAt) {
            this.deck.reset();
        }

        this._updatePlayerGraphics();
        this._updateDealerGraphics();
        this._setOutcome('');
    }
}

window.BlackjackGame = BlackjackGame;

// Deck represents a single or multiple decks of cards, with validation
// and an easy way to shuffle it.
class Deck {
    constructor(numDecks = 1) {
        this._validate(numDecks);

        this.cards = [];
        this.drawn = [];

        const suits = Object.values(Card.SUITS);
        for (let deck = 0; deck < numDecks; deck++) {
            for (let value = 2; value <= 14; value++) {
                for (const suit of suits) {
                    this.cards.push(new Card(value, suit));
                }
            }
        }
    }

    reset() {
        this.cards.push(...this.drawn);
        this.drawn = [];
        this.shuffle();
    }

    // shuffle shuffles the remaining cards.
    //
    // If you want to put the drawn cards back in and shuffle, use reset instead.
    shuffle(numTimes = 1) {
        if (isNaN(numTimes) || numTimes < 0) {
            throw   `Invalid value for argument 'numTimes', should be a ` +
                    `non-negative integer, was ${numTimes}`;
        }

        for (let i = 0; i < numTimes; i++) {
            // Fisher-Yates shuffle: https://medium.com/@oldwestaction/randomness-is-hard-e085decbcbb2
            for (let i = this.cards.length - 1; i > 0; i--) {
                // + 1 because Math.random generates [0, 1)
                // [ = inclusive, ) = exclusive, and we want the range [0, i].
                const swapIdx = Math.floor(Math.random() * (i + 1)); 
                const card = this.cards[i];
                this.cards[i] = this.cards[swapIdx];
                this.cards[swapIdx] = card;
            }
        }
    }

    // draw draws a card, resetting the deck if it runs out of cards.
    draw() {
        if (this.cards.length === 0) {
            this.reset();
        }
        const card = this.cards.pop();
        this.drawn.push(card);
        return card;
    }

    _validate(numDecks) {
        if (isNaN(numDecks) || numDecks < 1) {
            throw   `Validate Deck failed: Invalid value for argument ` +
                    `'numDecks', should be a positive integer, was: ${numDecks}.`;
        }
    }
}

// Card represents a single card, with validated values and an easy way to get
// the path for its corresponding image.
class Card {
    constructor(value, suit) {
        this.value = value;
        this.suit = suit;
        this._validate();
    }

    toString() {
        let prefix;
        switch (this.value) {
            case 2: case 3: case 4: case 5: case 6:
            case 7: case 8: case 9: case 10:
                prefix = this.value;
                break;
            case 11: case 12: case 13: case 14:
                prefix = Card.SPECIAL_CARD_NAMES[this.value - 11];
                break;
        }
        // Could be solved through renaming the files, but that's no good
        // if the images are used elsewhere out of my control.
        const shouldInclude2 = isNaN(prefix) && prefix !== 'ace';
        return `${prefix}_of_${this.suit}${shouldInclude2 ? '2' : ''}`;
    }

    imagePath() {
        return `resources/images/deck/${this.toString()}.png`;
    }

    _validate() {
        if (isNaN(this.value) || this.value < 2 || this.value > 14 || this.value !== Math.floor(this.value)) {
            throw   `Validate Card failed: Invalid value for property 'value', ` +
                    `should be an integer in the range 2 - 14 (inclusive), was: ${this.value}`;
        }

        const allowedSuits = Object.values(Card.SUITS);
        if (!allowedSuits.some(s => s === this.suit)) {
            const values = allowedSuits.map(s => `'${s}'`).join(', ');
            throw   `Validate Card failed: Invalid value for property 'suit', ` +
                    `should be one of ${values}, was: '${this.suit}'. Make ` +
                    `sure to use the SUITS object when assigning the suit.`;
        }
    }
}

Card.SUITS = {
    HEARTS: 'hearts',
    DIAMONDS: 'diamonds',
    CLUBS: 'clubs',
    SPADES: 'spades',
};
Card.SPECIAL_CARD_NAMES = ['jack', 'queen', 'king', 'ace'];