## What this site is
Queue Cartography is a class exhibit (CAI5735) about a small neural network that predicts how long a visitor waits at a clinic. Visitors set the hour, weekday, staff on shift and patients in the queue, and the network predicts the wait right in the browser. A 3-D map shows the predicted wait for every staffing level and queue length.

## Where the data came from
The data is the file clinic-wait-times.csv from the course website ({{dataSource}}). It contains {{rows}} simulated clinic visits. The data is **synthetic (made up)**: it does not describe any real clinic, hospital or patient. Each visit records the hour (8 am to 5 pm), the weekday (Monday to Friday), the staff on shift (1 to 5), the patients already in the queue (0 to 20), and the wait in minutes (0 to 324).

## What the model sees and predicts
- Inputs: hour, weekday, staff on shift, and patients in the queue.
- Output: the predicted wait in minutes.
- Model: a small neural network (a multilayer perceptron). The 4 inputs are encoded as 17 numbers (hour and weekday one-hot, staff and queue standardized), followed by two hidden layers of 16 and 8 ReLU neurons and one output. It has {{parameters}} weights in total.
- It was trained in Python with PyTorch, exported to ONNX, and runs in the visitor's browser with ONNX Runtime Web.

## How it was tested
The {{rows}} visits were split at random into {{train}} for training, {{val}} for validation (used to choose the network size and when to stop training), and {{test}} for testing. The {{test}} test visits were never used for training or tuning; they were used once, at the end.

## Results on the test set
Mean absolute error (the average size of a miss; lower is better):
- Neural network: {{nnMae}} minutes (95% interval {{nnLo}} to {{nnHi}}).
- Median baseline, which always predicts the training median of {{median}} minutes: {{baselineMae}} minutes.
- Linear regression on the same inputs: {{linearMae}} minutes.
- Queue-divided-by-staff formula: {{ratioMae}} minutes.

The network's error is {{reductionPct}}% lower than the median baseline. {{within10}}% of test visits were predicted within 10 minutes of the actual wait, and R² was {{r2}}.

## What visitors can discover
- Staffing has diminishing returns. With 12 patients waiting on Monday at 9 am, the network predicts {{w1}} minutes with 1 staff, {{w2}} with 2, {{w3}} with 3, {{w4}} with 4 and {{w5}} with 5. The 2nd staff member saves about {{s12}} minutes; the 5th saves about {{s45}}.
- Each patient in the queue adds roughly 15 minutes, divided by the number of staff on shift.
- Peak hours ({{peakHours}}) run longer, and Mondays run about {{mondayPct}}% longer than other weekdays.

## One mistake we studied
The largest test error was a {{missDay}} {{missHour}} visit with {{missStaff}} staff and {{missQueue}} patients queued. The actual wait was {{missActual}} minutes; the network predicted {{missNn}}. The {{missN}} training visits with the same staff and queue waited {{missMin}} to {{missMax}} minutes, so the network predicted close to similar visits. The gap is random variation that the four inputs cannot explain. More informative inputs (visit type, recent arrivals, no-shows), predicting a range instead of one number, or more data for that setting might have helped.

## Limitations
- The data is synthetic, so the results say nothing about any real clinic.
- The model only knows hours 8 am to 5 pm, Monday to Friday, 1 to 5 staff, and 0 to 20 patients in the queue. It should not be used outside those ranges.
- We have not tested the model on any other dataset or in any real clinic, so we have no results for how well it would work there.
- The model finds patterns in the data; it does not prove what causes waits. It is not medical, staffing or business advice.
- {{over10}}% of test visits were off by more than 10 minutes.

## Not covered by this guide
This guide does not cover real clinics or hospitals, costs, staffing policy, medical questions, other datasets, or details of how the data was simulated beyond what is written here.

## About this chatbot
The chatbot is a small language model (Qwen3) running entirely in the visitor's browser with WebLLM and WebGPU. It only knows this guide and the scenario currently set on the page, and it can make mistakes, so check its answers against the charts on the page.
