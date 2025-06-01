import numpy as np
from statsmodels.stats.inter_rater import fleiss_kappa

# Input arrays
rater1 = [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]
rater2 = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3]
rater3 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

# All ratings in one list of lists
all_ratings = list(zip(rater1, rater2, rater3))

# Determine number of categories (assumes labels are 1-indexed)
num_categories = max(max(rater1), max(rater2), max(rater3))

# Initialize matrix
rating_matrix = []

# Build the matrix
for item_ratings in all_ratings:
    counts = [0] * num_categories  # e.g., [0, 0, 0] for 3 categories
    for rating in item_ratings:
        counts[rating - 1] += 1    # rating - 1 to shift from 1-indexed to 0-indexed
    rating_matrix.append(counts)

# Convert to numpy array
rating_matrix = np.array(rating_matrix)

# Compute Fleiss's kappa
kappa = fleiss_kappa(rating_matrix, method='fleiss')
print("Fleiss's kappa:", kappa)
