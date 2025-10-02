from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello World!'
    
    
@app.route('/greetings')
def some_function():
    return "Helloworld!"


if __name__ == '__main__':
    app.run()
