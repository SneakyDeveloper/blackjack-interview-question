$('#ui-bar').remove();
$(document.head).find('#style-ui-bar').remove();

// BlackjackGame exposes three methods to play a one-person blackjack game.
//   deal, hit, and stay.
//
// Currently requires two HTML elements, with the IDs playerHand and dealerHand.
class BlackjackGame {
    constructor(numDecks, dealerHitsSoft17 = false) {
        this._player = new Hand('Player');
        this._dealer = new Hand('Dealer');

        this._deck = new Deck(numDecks);
        this._deck.shuffle();
        // Reshuffle when there's only a quarter of the deck left.
        this._reshuffleAt = Math.floor((numDecks * 52) / 4);
        this._hitsSoft17 = dealerHitsSoft17;
    }

    deal() {
        if (this._playing) {
            return;
        }
        
        this._reset();
        this._playing = true;

        this._playerDraw();
        this._playerDraw();
        this._dealerDraw();

        // Prevent player from accidentally hitting if they have a natural
        // blackjack.
        if (this._isNatural(this._player)) {
            this.stay();
        }
    }

    hit() {
        if (!this._playing) {
            return;
        }

        this._playerDraw();
    }

    stay() {
        if (!this._playing) {
            return;
        }

        this._playing = false;

        if (this._isBust(this._player)) {
            this._setOutcome('Player busted! Player loses.');
            return;
        }

        this._dealerPlay();
        const dealerScore = this._dealer.score;

        if (this._isNatural(this._player) && !this._isNatural(this._dealer)) {
            this._setOutcome('Player natural! Player wins.');
        } else if (!this._isNatural(this._player) && this._isNatural(this._dealer)) {
            this._setOutcome('Dealer natural! Player loses.');
        } else if (this._isBust(this._dealer)) {
            this._setOutcome('Dealer busted! Player wins.');
        } else if (this._player.score > this._dealer.score) {
            this._setOutcome('Player wins.');
        } else if (this._player.score < this._dealer.score) {
            this._setOutcome('Player loses.');
        } else {
            this._setOutcome(`It's a draw!`);
        }
    }

    _dealerPlay() {
        this._dealerDraw();
        if (this._isNatural(this._player) || this._isNatural(this._dealer)) {
            return;
        }

        while (true) {
            if (this._isBust(this._dealer)) {
                break;
            }

            const score = this._dealer.score;
            if (score === 21) {
                break;
            } else if (score < 17) {
                this._dealerDraw();
            } else if (this._hitsSoft17 && score === 17 && score !== this._dealer.lowScore) {
                this._dealerDraw();
            } else {
                break;
            }
        }
    }

    // _playerDraw draws a card for the player, and ends the game
    // if the player busts.
    _playerDraw() {
        this._player.drawFrom(this._deck);
        this._updateHandGraphics(this._player, '#playerHand');
        if (this._isBust(this._player)) {
            this.stay();
        }
    }

    // _dealerDraw draws a card for the dealer.
    _dealerDraw() {
        this._dealer.drawFrom(this._deck);
        this._updateHandGraphics(this._dealer, '#dealerHand');
    }

    // _updateHandGraphics updates the element specified by the selector with the
    // name, score and cards of the hand.
    _updateHandGraphics(hand, selector) {
        const html = this._generateHandHtml(hand);
        $(selector).html(html);
    }

    // _generateHandHtml generates HTML to display the score and cards of a hand,
    // displaying the hard value of the hand in parentheses if it's a soft hand.
    _generateHandHtml(hand) {
        const lowScore = hand.score !== hand.lowScore ? ` (${hand.lowScore})` : '';
        let html = `${hand.name}'s hand: ${hand.score}${lowScore}<br/>`;
        for (const card of hand.cards) {
            html += `<img class="card" src="${card.imagePath()}"/>`;
        }
        return html;
    }

    _setOutcome(str) {
        $('#mainLog').text(str);
    }

    _reset() {
        this._playing = false;
        this._player.reset();
        this._dealer.reset();
        if (this._deck.count() <= this._reshuffleAt) {
            this._deck.reset();
        }

        this._updateHandGraphics(this._player, '#playerHand');
        this._updateHandGraphics(this._dealer, '#dealerHand');
        this._setOutcome('');
    }

    _isNatural(hand) {
        return hand.score === 21 && hand.cards.length === 2;
    }

    _isBust(hand) {
        return hand.score > 21;
    }
}

window.BlackjackGame = BlackjackGame;

class Hand {
    constructor(name) {
        this.name = name;
        this.cards = [];
        this.isBust = false;
        this.isNatural = false;
        this.score = 0;
        this.lowScore = 0;
    }

    drawFrom(deck) {
        this.cards.push(deck.draw());
        this._update();
    }

    reset() {
        this.cards = [];
        this._update();
    }

    // _update updates the hand's state.
    _update() {
        let aces = 0;
        let score = 0;
        let lowScore = 0;
        // Tally up the score, keeping track of how many aces there are.
        for (const card of this.cards) {
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

        this.score = score;
        this.lowScore = lowScore;
    }
}

// Deck represents a single or multiple decks of cards, with validation
// and an easy way to shuffle it.
class Deck {
    constructor(numDecks = 1) {
        this._validate(numDecks);

        this._cards = [];

        const suits = Object.values(Card.SUITS);
        for (let deck = 0; deck < numDecks; deck++) {
            for (let value = 2; value <= 14; value++) {
                for (const suit of suits) {
                    this._cards.push(new Card(value, suit));
                }
            }
        }

        this.nextCardIdx = this._cards.length - 1;
    }

    count() {
        return this.nextCardIdx + 1;
    }

    reset() {
        this.nextCardIdx = this._cards.length - 1;
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
            for (let i = this.nextCardIdx; i > 0; i--) {
                // + 1 because Math.random generates [0, 1)
                // [ = inclusive, ) = exclusive, and we want the range [0, i].
                const swapIdx = Math.floor(Math.random() * (i + 1)); 
                const card = this._cards[i];
                this._cards[i] = this._cards[swapIdx];
                this._cards[swapIdx] = card;
            }
        }
    }

    // draw draws a card, resetting the deck if it has run out of cards.
    draw() {
        if (this.count() === 0) {
            this.reset();
        }
        const card = this._cards[this.nextCardIdx];
        this.nextCardIdx--;
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
