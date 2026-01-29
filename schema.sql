DROP TABLE IF EXISTS feedback;

CREATE TABLE feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    user_tier TEXT NOT NULL,
    product_area TEXT NOT NULL,
    sentiment TEXT NOT NULL DEFAULT 'Unknown',
    confidence REAL,
    human_sentiment TEXT,
    content TEXT NOT NULL,
    ai_analysis TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_sentiment ON feedback(sentiment);
CREATE INDEX idx_feedback_user_tier ON feedback(user_tier);
CREATE INDEX idx_feedback_product_area ON feedback(product_area);
CREATE INDEX idx_feedback_source ON feedback(source);
CREATE INDEX idx_feedback_confidence ON feedback(confidence);
